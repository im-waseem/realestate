"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nextStage } from "@/lib/stages";
import { requireUser } from "@/lib/auth";
import type { Property } from "@/lib/db";

function field(form: FormData, key: string, max = 500) {
  const value = String(form.get(key) || "").trim();
  if (!value || value.length > max) throw new Error(`Please provide a valid ${key} (maximum ${max} characters).`);
  return value;
}

function optionalField(form: FormData, key: string, max: number) {
  const value = String(form.get(key) || "").trim();
  if (value.length > max) throw new Error(`${key} is too long.`);
  return value;
}

function optionalNumber(form: FormData, key: string, min: number, max: number) {
  const raw = String(form.get(key) || "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}.`);
  return value;
}

function choice<T extends string>(form: FormData, key: string, options: readonly T[]): T {
  const value = field(form, key);
  const selected = options.find((option) => option === value);
  if (!selected) throw new Error(`Invalid ${key}.`);
  return selected;
}

function number(form: FormData, key: string, min: number, max: number) {
  const value = Number(field(form, key));
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}.`);
  return value;
}

function email(form: FormData) {
  const value = field(form, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
  return value;
}

function password(form: FormData) {
  const value = field(form, "password", 128);
  if (value.length < 12) throw new Error("Use at least 12 characters for the password.");
  return value;
}

function fail(path: string, error: unknown): never {
  redirect(`${path}?message=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save. Please try again.")}`);
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function rollbackRegistration(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  agencyId: string,
  cause: string,
) {
  const cleanupErrors: string[] = [];
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) cleanupErrors.push(`Auth cleanup failed: ${userError.message}`);
  const { error: agencyError } = await admin.from("agencies").delete().eq("id", agencyId);
  if (agencyError) cleanupErrors.push(`Agency cleanup failed: ${agencyError.message}`);
  throw new Error(cleanupErrors.length ? `${cause}; ${cleanupErrors.join("; ")}` : cause);
}

async function recordActivity(agencyId: string | null, actor: string, action: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("activity").insert({ id: randomUUID(), agency_id: agencyId, actor, action });
  throwIfError(error);
}

export async function login(form: FormData) {
  try {
    const supabase = await createSupabaseServerClient();
    const emailAddress = email(form);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailAddress,
      password: field(form, "password", 128),
    });
    throwIfError(error);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    throwIfError(userError);
    if (!userData.user) throw new Error("Email or password is incorrect.");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,agency_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    throwIfError(profileError);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error("This account has no workspace profile. Ask the main admin to configure it.");
    }
    if (profile.agency_id) {
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("status")
        .eq("id", profile.agency_id)
        .maybeSingle();
      throwIfError(agencyError);
      if (agency?.status !== "active") {
        await supabase.auth.signOut();
        throw new Error(agency?.status === "pending"
          ? "Your registration is awaiting main admin approval."
          : "Your agency workspace is suspended or unavailable.");
      }
    }
  } catch (error) {
    fail("/login", error);
  }
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
  redirect("/login");
}

export async function register(form: FormData) {
  try {
    const name = field(form, "name", 100);
    const agencyName = field(form, "agency", 150);
    const phone = field(form, "phone", 25);
    const address = field(form, "address", 500);
    const lat = optionalNumber(form, "lat", -90, 90);
    const lng = optionalNumber(form, "lng", -180, 180);
    const emailAddress = email(form);
    const newPassword = password(form);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid agency phone number.");
    if ((lat === null) !== (lng === null)) throw new Error("Provide both map coordinates or leave both blank.");

    const admin = createSupabaseAdminClient();
    const clientIp = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateKey = createHash("sha256").update(`register:${clientIp}`).digest("hex");
    const { data: registrationAllowed, error: rateLimitError } = await admin.rpc("realty_take_rate_limit", {
      target_key: rateKey,
      max_attempts: 5,
      window_seconds: 3600,
    });
    throwIfError(rateLimitError);
    if (!registrationAllowed) throw new Error("Too many registration attempts. Please try again later.");
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: emailAddress,
      password: newPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    throwIfError(authError);
    if (!authData.user) throw new Error("Unable to create the account.");

    const agencyId = randomUUID();
    const { error: agencyError } = await admin.from("agencies").insert({
      id: agencyId,
      name: agencyName,
      status: "pending",
      phone,
      address,
      lat,
      lng,
    });
    if (agencyError) {
      await rollbackRegistration(admin, authData.user.id, agencyId, agencyError.message);
    }
    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      name,
      email: emailAddress,
      role: "agency_admin",
      agency_id: agencyId,
    });
    if (profileError) {
      await rollbackRegistration(admin, authData.user.id, agencyId, profileError.message);
    }
    const { error: activityError } = await admin.from("activity").insert({
      id: randomUUID(),
      agency_id: agencyId,
      actor: name,
      action: "Registered agency and is awaiting admin approval",
    });
    if (activityError) await rollbackRegistration(admin, authData.user.id, agencyId, activityError.message);
  } catch (error) {
    fail("/register", error);
  }
  redirect("/login?message=Registration+submitted.+Your+agency+will+be+available+after+admin+approval.");
}

export async function createLead(form: FormData) {
  const user = await requireUser();
  try {
    const requestedAgencyId = String(form.get("agency_id") || "");
    const agencyId = user.role === "super_admin" ? requestedAgencyId : user.agency_id;
    if (!agencyId) throw new Error("Select an agency.");
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,status")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) throw new Error("Select an active agency.");
    const name = field(form, "name", 100);
    const phone = field(form, "phone", 25);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const { error } = await supabase.from("leads").insert({
      agency_id: agencyId,
      name,
      phone,
      email: email(form),
      intent: choice(form, "intent", ["buy", "sell", "rent", "lease"]),
      requirements: field(form, "requirements", 2000),
    });
    throwIfError(error);
    await recordActivity(agencyId, user.name, `Recorded customer requirement for ${name}`);
  } catch (error) {
    fail("/dashboard/leads/new", error);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?message=Customer+requirement+saved#leads");
}

export async function saveProperty(form: FormData) {
  const user = await requireUser();
  let id = String(form.get("id") || "");
  let destination = "/dashboard";
  try {
    const supabase = await createSupabaseServerClient();
    let existing: Property | undefined;
    if (id) {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
      throwIfError(error);
      existing = data ?? undefined;
      if (!existing || (user.role !== "super_admin" && existing.agency_id !== user.agency_id)) {
        throw new Error("Property not found.");
      }
    }
    const requestedAgencyId = String(form.get("agency_id") || "");
    const agencyId = user.role === "super_admin" ? existing?.agency_id || requestedAgencyId : existing?.agency_id || user.agency_id;
    if (!agencyId) throw new Error("Select an agency.");
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,status")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) {
      throw new Error("Your agency workspace is not active.");
    }
    destination = `/dashboard/properties/${id || "new"}`;

    if (form.get("uploading") === "yes") throw new Error("Wait for photo uploads to finish before saving.");
    const images = field(form, "images", 6000).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (images.length > 12) throw new Error("Use up to 12 image URLs.");
    for (const image of images) {
      if (/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image) || /^\/images\/(interior|architecture)\.jpg$/.test(image)) continue;
      const url = new URL(image);
      if (url.protocol !== "https:") throw new Error("Images must use HTTPS URLs.");
    }

    const propertyType = choice(form, "type", ["Apartment", "Villa", "Independent house", "Builder floor", "Penthouse", "Studio", "Plot", "Farm house", "Office", "Shop", "Showroom", "Warehouse"]);
    const floor = number(form, "floor_number", 0, 200);
    const totalFloors = optionalNumber(form, "total_floors", 1, 200);
    if (totalFloors !== null && (floor > totalFloors || !Number.isInteger(totalFloors))) {
      throw new Error("Total floors must be a whole number at least as high as the property floor.");
    }
    const cars = number(form, "car_parking", 0, 100);
    const twoWheelers = number(form, "two_wheeler_parking", 0, 100);
    const age = optionalNumber(form, "age_years", 0, 200);
    if (!Number.isInteger(floor) || !Number.isInteger(cars) || !Number.isInteger(twoWheelers) || (age !== null && !Number.isInteger(age))) {
      throw new Error("Floor, parking, and property age must be whole numbers.");
    }

    const values = {
      title: field(form, "title", 150),
      intent: choice(form, "intent", ["sale", "rent", "lease"]),
      type: propertyType,
      price: number(form, "price", 1, 1e12),
      beds: number(form, "beds", 0, 50),
      baths: number(form, "baths", 0, 50),
      area: number(form, "area", 1, 1e8),
      locality: field(form, "locality", 150),
      city: field(form, "city", 100),
      address: field(form, "address", 500),
      lat: number(form, "lat", -90, 90),
      lng: number(form, "lng", -180, 180),
      description: field(form, "description", 5000),
      amenities: field(form, "amenities", 1000),
      images: JSON.stringify(images),
      status: "published",
      floor_number: floor,
      total_floors: totalFloors,
      car_parking: cars,
      two_wheeler_parking: twoWheelers,
      furnishing: choice(form, "furnishing", ["furnished", "semi_furnished", "unfurnished", "not_applicable"]),
      age_years: age,
    };

    if (existing) {
      const { data, error } = await supabase.from("properties").update(values).eq("id", id).select("id").maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("Property not found.");
    } else {
      id = randomUUID();
      const { error } = await supabase.from("properties").insert({ ...values, id, agency_id: agencyId });
      throwIfError(error);
    }
    await recordActivity(agencyId, user.name, `${existing ? "Updated" : "Created"} property: ${values.title}; published by agency`);
  } catch (error) {
    fail(destination, error);
  }
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  revalidatePath("/");
  redirect("/dashboard?message=Property+saved+and+published#inventory");
}

export async function propertyStatus(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id");
    const supabase = await createSupabaseServerClient();
    const { data: property, error: propertyError } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    throwIfError(propertyError);
    if (!property || (user.role !== "super_admin" && property.agency_id !== user.agency_id)) throw new Error("Property not found.");
    const status = choice(form, "status", ["published", "sold", "rented", "withdrawn"]);
    const { data, error } = await supabase.from("properties").update({ status }).eq("id", id).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Property not found.");
    await recordActivity(property.agency_id, user.name, `${property.title}: ${status}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function deleteProperty(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id");
    const supabase = await createSupabaseServerClient();
    const { data: property, error: propertyError } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    throwIfError(propertyError);
    if (!property || (user.role !== "super_admin" && property.agency_id !== user.agency_id)) throw new Error("Property not found.");

    const { data: linkedLeads, error: leadsError } = await supabase.from("leads").select("id").eq("property_id", id).limit(1);
    throwIfError(leadsError);
    if ((linkedLeads ?? []).length && user.role !== "super_admin") {
      throw new Error("This property has customer enquiries. Resolve or remove those enquiries before deleting it.");
    }
    if (user.role === "super_admin" && (linkedLeads ?? []).length) {
      const { error } = await supabase.from("leads").delete().eq("property_id", id);
      throwIfError(error);
    }
    const { data, error } = await supabase.from("properties").delete().eq("id", id).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Property not found.");
    await recordActivity(property.agency_id, user.name, `Deleted property: ${property.title}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/properties");
  revalidatePath("/");
}

export async function updateAgencyProfile(form: FormData) {
  const user = await requireUser();
  if (user.role !== "agency_admin" && user.role !== "super_admin") {
    fail("/dashboard", new Error("Only agency admins and the main admin can edit agency details."));
  }
  try {
    const agencyId = user.role === "super_admin" ? field(form, "agency_id", 100) : user.agency_id;
    if (!agencyId) throw new Error("Access denied.");
    const name = field(form, "name", 150);
    const phone = field(form, "phone", 25);
    const address = field(form, "address", 500);
    const lat = optionalNumber(form, "lat", -90, 90);
    const lng = optionalNumber(form, "lng", -180, 180);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid agency phone number.");
    if ((lat === null) !== (lng === null)) throw new Error("Provide both map coordinates or leave both blank.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("agencies").update({ name, phone, address, lat, lng }).eq("id", agencyId).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Agency not found.");
    await recordActivity(agencyId, user.name, "Updated agency contact and office details");
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function setAgencyStatus(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency status."));
  try {
    const id = field(form, "agency_id", 100);
    const status = choice(form, "status", ["active", "suspended"]);
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,name,status").eq("id", id).maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    const { error } = await supabase.from("agencies").update({ status }).eq("id", id);
    throwIfError(error);
    const action = status === "active"
      ? `${agency.status === "pending" ? "Approved" : "Reactivated"} agency ${agency.name}`
      : `Suspended agency ${agency.name}`;
    await recordActivity(id, user.name, action);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function deleteAgency(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can delete agencies."));
  try {
    const id = field(form, "agency_id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,name").eq("id", id).maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    const { data: uploads, error: uploadsError } = await supabase.from("uploads").select("name").eq("agency_id", id);
    throwIfError(uploadsError);
    if ((uploads ?? []).length) {
      const { error: storageError } = await supabase.storage
        .from("property-photos")
        .remove((uploads ?? []).map((upload) => upload.name));
      if (storageError) {
        throw new Error(`Unable to remove agency photos. Run the latest sql/schema.postgres.sql, then retry. ${storageError.message}`);
      }
    }
    const { error: deleteError } = await supabase.rpc("realty_admin_delete_agency", { target_agency_id: id });
    throwIfError(deleteError);
    await recordActivity(null, user.name, `Deleted agency ${agency.name} and its workspace data`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function addStaff(form: FormData) {
  const user = await requireUser();
  if (user.role !== "agency_admin" && user.role !== "super_admin") {
    fail("/dashboard", new Error("Only agency admins and the main admin can manage team members."));
  }
  try {
    const requested = String(form.get("agency_id") || "");
    const agencyId = user.role === "super_admin" ? requested : user.agency_id;
    if (!agencyId) throw new Error("Select an agency.");
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,status").eq("id", agencyId).maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) throw new Error("Select an active agency.");
    const emailAddress = email(form);
    const name = field(form, "name", 100);
    const admin = createSupabaseAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: emailAddress,
      password: password(form),
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    throwIfError(authError);
    if (!authData.user) throw new Error("Unable to create the account.");
    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      name,
      email: emailAddress,
      role: "agent",
      agency_id: agencyId,
    });
    if (profileError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(cleanupError
        ? `${profileError.message}; auth-user cleanup failed: ${cleanupError.message}`
        : profileError.message);
    }
    await recordActivity(agencyId, user.name, `Added agent ${name}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function updateStaff(form: FormData) {
  const user = await requireUser();
  if (user.role !== "agency_admin" && user.role !== "super_admin") {
    fail("/dashboard", new Error("Only agency admins and the main admin can manage team members."));
  }
  try {
    const id = field(form, "id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: member, error: memberError } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    throwIfError(memberError);
    if (!member || member.role === "super_admin" || (user.role !== "super_admin" && (member.agency_id !== user.agency_id || member.role !== "agent"))) {
      throw new Error("Team member not found.");
    }
    const name = field(form, "name", 100);
    const emailAddress = email(form);
    const requestedAgencyId = String(form.get("agency_id") || "");
    const agencyId = user.role === "super_admin" ? requestedAgencyId : user.agency_id;
    const role = user.role === "super_admin"
      ? choice(form, "role", ["agent", "agency_admin"])
      : "agent";
    if (!agencyId) throw new Error("Select an agency.");
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,status").eq("id", agencyId).maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) throw new Error("Select an active agency.");

    const admin = createSupabaseAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email: emailAddress,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    throwIfError(authError);
    const { error } = await admin.from("profiles").update({ name, email: emailAddress, role, agency_id: agencyId }).eq("id", id);
    throwIfError(error);
    await recordActivity(agencyId, user.name, `Updated team member ${name}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function deleteStaff(form: FormData) {
  const user = await requireUser();
  if (user.role !== "agency_admin" && user.role !== "super_admin") {
    fail("/dashboard", new Error("Only agency admins and the main admin can remove team members."));
  }
  try {
    const id = field(form, "id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: member, error: memberError } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    throwIfError(memberError);
    if (!member || member.role === "super_admin" || (user.role !== "super_admin" && (member.agency_id !== user.agency_id || member.role !== "agent"))) {
      throw new Error("Team member not found.");
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    throwIfError(error);
    await recordActivity(member.agency_id, user.name, `Removed team member ${member.name}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function saveLead(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("leads").select("agency_id").eq("id", id).maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) throw new Error("Enquiry not found.");
    const name = field(form, "name", 100);
    const phone = field(form, "phone", 25);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const status = choice(form, "status", ["new", "contacted", "visit scheduled", "negotiating", "closed", "lost"]);
    const notes = optionalField(form, "notes", 4000);
    const { error } = await supabase.from("leads").update({
      name,
      phone,
      email: email(form),
      intent: choice(form, "intent", ["buy", "sell", "rent", "lease"]),
      requirements: field(form, "requirements", 2000),
      status,
      notes,
    }).eq("id", id);
    throwIfError(error);
    await recordActivity(lead.agency_id, user.name, `Updated enquiry ${id.slice(0, 8)} to ${status}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function deleteLead(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("leads").select("agency_id").eq("id", id).maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) throw new Error("Enquiry not found.");
    const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Enquiry not found.");
    await recordActivity(lead.agency_id, user.name, `Deleted enquiry ${id.slice(0, 8)}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/properties");
}

export async function advanceLead(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id");
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("leads").select("agency_id,status").eq("id", id).maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) throw new Error("Enquiry not found.");
    const next = nextStage(lead.status);
    const { error } = await supabase.from("leads").update({ status: next }).eq("id", id);
    throwIfError(error);
    await recordActivity(lead.agency_id, user.name, `Advanced customer ${id.slice(0, 8)} to ${next}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function reopenLead(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id");
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("leads").select("agency_id").eq("id", id).maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) throw new Error("Enquiry not found.");
    const { error } = await supabase.from("leads").update({ status: "new" }).eq("id", id);
    throwIfError(error);
    await recordActivity(lead.agency_id, user.name, `Reopened customer ${id.slice(0, 8)}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
}

export async function removeLead(form: FormData) {
  return deleteLead(form);
}
