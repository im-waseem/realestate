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
import { propertySchema, propertyStatusToDatabase } from "@/lib/property-schema";
import { hasAgencyFeature, normalizeAgencyFeatures } from "@/lib/features";
import { z } from "zod";

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

function email(form: FormData) {
  const value = field(form, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
  return value;
}

function optionalEmail(form: FormData) {
  const value = optionalField(form, "email", 254).toLowerCase();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
  return value;
}

function password(form: FormData) {
  const value = field(form, "password", 128);
  if (value.length < 12) throw new Error("Use at least 12 characters for the password.");
  return value;
}

function safeReturnPath(value: FormDataEntryValue | null) {
  const path = String(value || "").trim();
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/dashboard";
}

function fail(path: string, error: unknown): never {
  redirect(`${path}?message=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save. Please try again.")}`);
}

function failServiceProvider(path: string, error: unknown): never {
  const message = encodeURIComponent(error instanceof Error ? error.message : "Unable to save. Please try again.");
  redirect(path === "/dashboard/services" ? `${path}?message=${message}` : `/dashboard?message=${message}#services`);
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const loanOptionalText = z.string().trim().max(100).transform((value) => value || null);
const loanCreateSchema = z.object({
  agency_id: z.string().trim().min(1).max(100),
  loan_type: z.enum(["personal_loan", "business_loan", "home_loan", "lap", "education_loan"]),
  source_lead_id: loanOptionalText,
  property_id: loanOptionalText,
  customer_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().regex(/^[+\d ()-]{7,25}$/, "Enter a valid phone number."),
  email: z.string().trim().max(254).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address."),
  loan_amount: z.coerce.number().finite().min(0.01).max(999999999999.99),
  monthly_income: z.coerce.number().finite().min(0.01).max(999999999999.99),
  employment_type: z.enum(["salaried", "self_employed", "business_owner", "other"]),
  city: z.string().trim().min(1).max(100),
  preferred_bank: z.string().trim().max(150),
  assigned_to: z.string().trim().uuid().or(z.literal("")).transform((value) => value || null),
  notes: z.string().trim().max(4000),
});

function loanCreateValues(form: FormData) {
  return {
    agency_id: String(form.get("agency_id") || "").trim(),
    loan_type: String(form.get("loan_type") || "home_loan"),
    source_lead_id: String(form.get("source_lead_id") || "").trim(),
    property_id: String(form.get("property_id") || "").trim(),
    customer_name: String(form.get("customer_name") || ""),
    phone: String(form.get("phone") || ""),
    email: String(form.get("email") || ""),
    loan_amount: form.get("loan_amount"),
    monthly_income: form.get("monthly_income"),
    employment_type: String(form.get("employment_type") || ""),
    city: String(form.get("city") || ""),
    preferred_bank: String(form.get("preferred_bank") || ""),
    assigned_to: String(form.get("assigned_to") || "").trim(),
    notes: String(form.get("notes") || ""),
  };
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
  const nextPath = safeReturnPath(form.get("next"));
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
      .select("id,agency_id,is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    throwIfError(profileError);
    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      throw new Error(profile ? "This account is deactivated. Contact an agency admin." : "This account has no workspace profile. Ask the main admin to configure it.");
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
    const message = encodeURIComponent(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    redirect(`/login?message=${message}&next=${encodeURIComponent(nextPath)}`);
  }
  redirect(nextPath);
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
      contact_name: name,
      contact_email: emailAddress,
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
  let agencyId = "";
  try {
    const requestedAgencyId = String(form.get("agency_id") || "");
    agencyId = user.role === "super_admin" ? requestedAgencyId : user.agency_id || "";
    if (!agencyId) throw new Error("Select an agency.");
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,status")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) throw new Error("Select an active agency.");
    const propertyId = optionalField(form, "property_id", 100);
    if (propertyId) {
      const { data: property, error: propertyError } = await supabase.from("properties").select("id").eq("id", propertyId).eq("agency_id", agencyId).maybeSingle();
      throwIfError(propertyError);
      if (!property) throw new Error("Select a property from this agency.");
    }
    const name = field(form, "name", 100);
    const phone = field(form, "phone", 25);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const { error } = await supabase.from("leads").insert({
      id: randomUUID(),
      agency_id: agencyId,
      property_id: propertyId || null,
      name,
      phone,
      email: optionalEmail(form),
      client_address: optionalField(form, "client_address", 500),
      source: choice(form, "source", ["walk_in", "phone", "website", "referral", "other"] as const),
      intent: choice(form, "intent", ["buy", "sell", "rent", "lease"]),
      requirements: field(form, "requirements", 2000),
    });
    throwIfError(error);
    await recordActivity(agencyId, user.name, `Recorded customer requirement for ${name}`);
  } catch (error) {
    fail("/dashboard/leads/new", error);
  }
  revalidatePath("/dashboard");
  redirect(user.role === "super_admin"
    ? `/dashboard?message=Customer+requirement+saved&openAgency=${encodeURIComponent(agencyId)}#agencies`
    : "/dashboard?message=Customer+requirement+saved#leads");
}

export async function submitAgencyQrEnquiry(form: FormData) {
  const agencyId = String(form.get("agency_id") || "").trim();
  const destination = `/agency/${encodeURIComponent(agencyId)}`;
  if (String(form.get("website") || "").trim()) redirect(`${destination}?sent=1`);
  try {
    if (!/^[a-f0-9-]{36}$/i.test(agencyId)) throw new Error("This agency QR link is invalid.");
    const customerName = field(form, "name", 100);
    const phone = field(form, "phone", 25);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid mobile number.");
    const emailAddress = optionalField(form, "email", 254).toLowerCase();
    if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) throw new Error("Enter a valid email address.");
    const intent = choice(form, "intent", ["buy", "sell", "rent", "lease"] as const);
    const requirements = field(form, "requirements", 2000);
    if (requirements.length < 10) throw new Error("Please describe what you are looking for (at least 10 characters).");
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("realty_submit_agency_enquiry", {
      target_agency_id: agencyId,
      customer_name: customerName,
      customer_phone: phone,
      customer_email: emailAddress,
      enquiry_intent: intent,
      customer_message: requirements,
    });
    throwIfError(error);
  } catch (error) {
    fail(destination, error);
  }
  revalidatePath("/dashboard");
  redirect(`${destination}?sent=1`);
}

export async function saveProperty(form: FormData) {
  const user = await requireUser();
  let id = String(form.get("id") || "");
  try {
    const raw = Object.fromEntries(form.entries()) as Record<string, unknown>;
    const parsed = propertySchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Check the property details." };
    const input = parsed.data;
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
    const values = {
      title: input.title, intent: input.intent, type: input.type, price: input.price,
      beds: input.beds, baths: input.baths, area: input.area, locality: input.locality,
      city: input.city, address: input.address, owner_name: input.owner_name,
      owner_phone: input.owner_phone, owner_email: input.owner_email, lat: input.lat, lng: input.lng,
      description: input.description, amenities: input.amenities,
      images: JSON.stringify(input.images.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)),
      status: propertyStatusToDatabase(input.status), featured: input.featured,
      floor_number: input.floor_number, total_floors: input.total_floors,
      car_parking: input.car_parking, two_wheeler_parking: input.two_wheeler_parking,
      furnishing: input.furnishing, age_years: input.age_years,
    };
    if (form.get("uploading") === "yes") return { ok: false, message: "Wait for photo uploads to finish before saving." };
    if (values.owner_phone) {
      const admin = createSupabaseAdminClient();
      const { data: registeredElsewhere, error: duplicateError } = await admin.rpc("realty_owner_phone_registered_elsewhere", {
        target_phone: values.owner_phone,
        target_agency_id: agencyId,
        excluded_property_id: id || null,
      });
      throwIfError(duplicateError);
      if (registeredElsewhere) {
        throw new Error("This owner mobile number is already registered to another agency. Check that you have authorization to list this property before trying again.");
      }
    }

    if (existing) {
      const { data, error } = await supabase.from("properties").update(values).eq("id", id).select("id").maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("Property not found.");
    } else {
      id = randomUUID();
      const { error } = await supabase.from("properties").insert({ ...values, id, agency_id: agencyId });
      throwIfError(error);
    }
    await recordActivity(agencyId, user.name, `${existing ? "Updated" : "Created"} property: ${values.title}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save property." };
  }
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true, message: "Property saved." };
}

export async function propertyStatus(form: FormData) {
  const user = await requireUser();
  try {
    const id = field(form, "id");
    const supabase = await createSupabaseServerClient();
    const { data: property, error: propertyError } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    throwIfError(propertyError);
    if (!property || (user.role !== "super_admin" && property.agency_id !== user.agency_id)) throw new Error("Property not found.");
    const statusValue = choice(form, "status", ["draft", "active", "sold", "rented"] as const);
    const status = propertyStatusToDatabase(statusValue);
    const { data, error } = await supabase.from("properties").update({ status }).eq("id", id).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Property not found.");
    await recordActivity(property.agency_id, user.name, `${property.title}: ${status}`);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update property." };
  }
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true, message: "Property status updated." };
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
    return { ok: false, message: error instanceof Error ? error.message : "Unable to delete property." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/properties");
  revalidatePath("/");
  return { ok: true, message: "Property deleted." };
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
    const contactName = field(form, "contact_name", 100);
    const contactEmail = field(form, "contact_email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error("Enter a valid business email address.");
    const phone = field(form, "phone", 25);
    const whatsapp = optionalField(form, "whatsapp", 25);
    if (whatsapp && !/^[+\d ()-]{7,25}$/.test(whatsapp)) throw new Error("Enter a valid WhatsApp number.");
    const website = optionalField(form, "website", 300);
    if (website) {
      let parsedWebsite: URL;
      try { parsedWebsite = new URL(website); } catch { throw new Error("Enter a valid website URL starting with https://."); }
      if (parsedWebsite.protocol !== "https:" && parsedWebsite.protocol !== "http:") throw new Error("Website URLs must use http:// or https://.");
    }
    const registrationNumber = optionalField(form, "registration_number", 100);
    const address = field(form, "address", 500);
    const city = field(form, "city", 100);
    const state = field(form, "state", 100);
    const postalCode = optionalField(form, "postal_code", 20);
    const serviceAreas = optionalField(form, "service_areas", 1000);
    const workingHours = optionalField(form, "working_hours", 300);
    const description = optionalField(form, "description", 2000);
    const logoUrl = optionalField(form, "logo_url", 1000);
    if (logoUrl && !/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(logoUrl)) {
      let parsedLogo: URL;
      try { parsedLogo = new URL(logoUrl); } catch { throw new Error("Upload a logo image or provide an HTTPS image URL."); }
      if (parsedLogo.protocol !== "https:") throw new Error("Logo URLs must use HTTPS.");
    }
    const lat = optionalNumber(form, "lat", -90, 90);
    const lng = optionalNumber(form, "lng", -180, 180);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid agency phone number.");
    if ((lat === null) !== (lng === null)) throw new Error("Provide both map coordinates or leave both blank.");
    if (form.get("location_confirmed") !== "yes") throw new Error("Please confirm the map pin for the office address.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("agencies").update({
      name,
      contact_name: contactName,
      contact_email: contactEmail,
      phone,
      whatsapp,
      website,
      registration_number: registrationNumber,
      address,
      city,
      state,
      postal_code: postalCode,
      service_areas: serviceAreas,
      working_hours: workingHours,
      description,
      logo_url: logoUrl,
      lat,
      lng,
    }).eq("id", agencyId).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Agency not found.");
    await recordActivity(agencyId, user.name, "Updated agency contact and office details");
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function updateAgencyFeature(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency features."));
  try {
    const agencyId = field(form, "agency_id", 100);
    const feature = choice(form, "feature", ["home_loans", "tools"] as const);
    const enabledValue = choice(form, "enabled", ["true", "false"] as const);
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("features")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    const features = normalizeAgencyFeatures(agency.features);
    features[feature] = enabledValue === "true";
    const { data, error } = await supabase
      .from("agencies")
      .update({ features })
      .eq("id", agencyId)
      .select("id")
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Agency not found.");
    await recordActivity(agencyId, user.name, `${features[feature] ? "Enabled" : "Disabled"} ${feature.replace("_", " ")} feature`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  redirect("/dashboard#agencies");
}

export async function updateAgencyLoanProduct(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency loan products."));
  let agencyId = "";
  try {
    agencyId = field(form, "agency_id", 100);
    const loanType = choice(form, "loan_type", ["personal_loan", "business_loan", "home_loan", "lap", "education_loan"] as const);
    const enabled = choice(form, "enabled", ["true", "false"] as const) === "true";
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("agency_loan_products").upsert({ agency_id: agencyId, loan_type: loanType, enabled }, { onConflict: "agency_id,loan_type" });
    throwIfError(error);
    const { data: enabledRows, error: enabledError } = await supabase.from("agency_loan_products").select("loan_type").eq("agency_id", agencyId).eq("enabled", true);
    throwIfError(enabledError);
    const { data: agency, error: agencyReadError } = await supabase.from("agencies").select("features").eq("id", agencyId).maybeSingle();
    throwIfError(agencyReadError);
    if (!agency) throw new Error("Agency not found.");
    const features = normalizeAgencyFeatures(agency.features);
    features.home_loans = (enabledRows || []).length > 0;
    const { error: featureError } = await supabase.from("agencies").update({ features }).eq("id", agencyId);
    throwIfError(featureError);
    await recordActivity(agencyId, user.name, `${enabled ? "Enabled" : "Disabled"} ${loanType.replaceAll("_", " ")}`);
  } catch (error) {
    fail("/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/home-loans");
  redirect("/dashboard#loans");
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

export async function setAgencyActive(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency active status."));
  try {
    const id = field(form, "agency_id", 100);
    const active = form.get("is_active") === "true";
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,name,status,is_active")
      .eq("id", id)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    const { error } = await supabase
      .from("agencies")
      .update({ is_active: active, status: active ? "active" : "suspended" })
      .eq("id", id);
    throwIfError(error);
    await recordActivity(id, user.name, `${active ? "Enabled" : "Disabled"} agency ${agency.name}`);
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
    const { data: loanDocuments, error: loanDocumentsError } = await supabase
      .from("loan_documents")
      .select("file_path")
      .eq("agency_id", id);
    throwIfError(loanDocumentsError);
    if ((loanDocuments ?? []).length) {
      const admin = createSupabaseAdminClient();
      const { error: storageError } = await admin.storage
        .from("loan-documents")
        .remove((loanDocuments ?? []).map((document) => document.file_path));
      if (storageError) throw new Error(`Unable to remove the agency's private loan documents. ${storageError.message}`);
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
    const role = user.role === "super_admin" ? choice(form, "role", ["agent", "agency_admin"] as const) : "agent";
    const admin = createSupabaseAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(emailAddress, {
      data: { full_name: name },
      ...(siteUrl ? { redirectTo: `${siteUrl}/invite/accept` } : {}),
    });
    throwIfError(authError);
    if (!authData.user) throw new Error("Unable to create the account.");
    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      name,
      email: emailAddress,
      role,
      agency_id: agencyId,
    });
    if (profileError) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
      throw new Error(cleanupError
        ? `${profileError.message}; auth-user cleanup failed: ${cleanupError.message}`
        : profileError.message);
    }
    await recordActivity(agencyId, user.name, `Invited ${role === "agency_admin" ? "agency admin" : "agent"} ${name}`);
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

export async function setStaffActive(form: FormData) {
  const user = await requireUser();
  if (user.role !== "agency_admin" && user.role !== "super_admin") {
    fail("/dashboard", new Error("Only agency admins and the main admin can manage team access."));
  }
  try {
    const id = field(form, "id", 100);
    const active = form.get("is_active") === "true";
    if (id === user.id) throw new Error("You cannot deactivate your own account.");
    const supabase = await createSupabaseServerClient();
    const { data: member, error: memberError } = await supabase.from("profiles").select("id,name,role,agency_id,is_active").eq("id", id).maybeSingle();
    throwIfError(memberError);
    if (!member || member.role === "super_admin" || (user.role !== "super_admin" && (member.agency_id !== user.agency_id || member.role !== "agent"))) {
      throw new Error("Team member not found.");
    }
    const memberAgencyId = member.agency_id;
    if (!memberAgencyId) throw new Error("This team member has no assigned agency.");
    if (!active && member.role === "agency_admin") {
      const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("agency_id", memberAgencyId).eq("role", "agency_admin").eq("is_active", true);
      throwIfError(error);
      if ((count || 0) <= 1) throw new Error("An agency must keep at least one active admin.");
    }
    const admin = createSupabaseAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    throwIfError(authError);
    const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", id);
    throwIfError(error);
    await recordActivity(memberAgencyId, user.name, `${active ? "Reactivated" : "Deactivated"} ${member.role} ${member.name}`);
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
    const status = choice(form, "status", ["new", "contacted", "visit", "visit scheduled", "negotiating", "closed", "lost"]);
    const notes = optionalField(form, "notes", 4000);
    const assignedTo = optionalField(form, "assigned_to", 100);
    if (assignedTo) {
      const { data: assignee, error: assigneeError } = await supabase.from("profiles").select("id,agency_id,role").eq("id", assignedTo).maybeSingle();
      throwIfError(assigneeError);
      if (!assignee || assignee.role === "super_admin" || assignee.agency_id !== lead.agency_id) throw new Error("Choose a team member from this agency.");
    }
    const propertyId = optionalField(form, "property_id", 100);
    if (propertyId) {
      const { data: property, error: propertyError } = await supabase.from("properties").select("id").eq("id", propertyId).eq("agency_id", lead.agency_id).maybeSingle();
      throwIfError(propertyError);
      if (!property) throw new Error("Choose a property from this agency.");
    }
    const { error } = await supabase.from("leads").update({
      name,
      phone,
      email: optionalEmail(form),
      client_address: optionalField(form, "client_address", 500),
      source: choice(form, "source", ["walk_in", "phone", "website", "referral", "other"] as const),
      intent: choice(form, "intent", ["buy", "sell", "rent", "lease"]),
      requirements: field(form, "requirements", 2000),
      status,
      notes,
      assigned_to: assignedTo || null,
      property_id: propertyId || null,
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

export async function saveServiceProvider(form: FormData) {
  const user = await requireUser();
  const returnPath = form.get("return_to") === "/dashboard/services" ? "/dashboard/services" : "/dashboard";
  if (!hasAgencyFeature(user, "tools")) failServiceProvider(returnPath, new Error("The tools feature is not enabled for your agency."));
  try {
    if (user.role !== "super_admin" && !user.agency_id) throw new Error("Only agency workspaces can manage service providers.");
    const id = String(form.get("id") || "").trim();
    const agencyId = user.role === "super_admin" ? field(form, "agency_id", 100) : user.agency_id!;

    const supabase = await createSupabaseServerClient();
    let existingAgencyId: string | null = null;
    if (id) {
      const { data, error } = await supabase.from("service_providers").select("id,agency_id").eq("id", id).maybeSingle();
      throwIfError(error);
      if (!data || (user.role !== "super_admin" && data.agency_id !== user.agency_id)) {
        throw new Error("Service provider not found in your agency.");
      }
      existingAgencyId = data.agency_id;
    }

    const name = field(form, "name", 100);
    const phone = field(form, "phone", 25);
    if (!/^[+\d ()-]{7,25}$/.test(phone)) throw new Error("Enter a valid phone number.");
    const emailAddress = optionalField(form, "email", 254).toLowerCase();
    if (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) throw new Error("Enter a valid email address.");
    const category = field(form, "category", 60);
    const serviceArea = field(form, "service_area", 200);
    const address = optionalField(form, "address", 500);
    const notes = optionalField(form, "notes", 2000);
    const isActive = form.get("is_active") === "on";
    const values = { agency_id: agencyId, name, category, phone, email: emailAddress, service_area: serviceArea, address, notes, is_active: isActive };
    const result = id
      ? await supabase.from("service_providers").update(values).eq("id", id).select("id").maybeSingle()
      : await supabase.from("service_providers").insert(values).select("id").maybeSingle();
    throwIfError(result.error);
    if (!result.data) throw new Error("Unable to save service provider.");

    const activityAgencyId = existingAgencyId || agencyId;
    await recordActivity(activityAgencyId, user.name, `${id ? "Updated" : "Added"} ${category.toLowerCase()} contact ${name}`);
  } catch (error) {
    failServiceProvider(returnPath, error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  redirect(returnPath === "/dashboard/services" ? "/dashboard/services?message=Service+provider+saved" : "/dashboard?message=Service+provider+saved#services");
}

export async function deleteServiceProvider(form: FormData) {
  const user = await requireUser();
  const returnPath = form.get("return_to") === "/dashboard/services" ? "/dashboard/services" : "/dashboard";
  if (!hasAgencyFeature(user, "tools")) failServiceProvider(returnPath, new Error("The tools feature is not enabled for your agency."));
  try {
    if (user.role !== "super_admin" && !user.agency_id) throw new Error("Only agency workspaces can manage service providers.");
    const id = field(form, "id", 100);
    const supabase = await createSupabaseServerClient();
    const { data: provider, error: providerError } = await supabase
      .from("service_providers")
      .select("id,agency_id,name,category")
      .eq("id", id)
      .maybeSingle();
    throwIfError(providerError);
    if (!provider || (user.role !== "super_admin" && provider.agency_id !== user.agency_id)) {
      throw new Error("Service provider not found in your agency.");
    }
    const { data, error } = await supabase.from("service_providers").delete().eq("id", id).select("id").maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Service provider not found.");
    await recordActivity(provider.agency_id, user.name, `Removed ${provider.category.toLowerCase()} contact ${provider.name}`);
  } catch (error) {
    failServiceProvider(returnPath, error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  if (returnPath === "/dashboard/services") redirect("/dashboard/services?message=Service+provider+removed");
}

export async function createLoanLead(form: FormData) {
  const user = await requireUser();
  if (!hasAgencyFeature(user, "home_loans")) {
    return { ok: false as const, message: "Home loans are not enabled for your agency." };
  }

  const parsed = loanCreateSchema.safeParse(loanCreateValues(form));
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message || "Check the home-loan details and try again." };
  }

  try {
    const values = parsed.data;
    const agencyId = user.role === "super_admin" ? values.agency_id : user.agency_id;
    if (!agencyId || (user.role !== "super_admin" && values.agency_id !== agencyId)) {
      return { ok: false as const, message: "Select an agency you can access." };
    }

    const supabase = await createSupabaseServerClient();
    const { data: product, error: productError } = await supabase.from("agency_loan_products").select("enabled").eq("agency_id", agencyId).eq("loan_type", values.loan_type).maybeSingle();
    throwIfError(productError);
    if (!product?.enabled) return { ok: false as const, message: "This loan type is not enabled for the selected agency." };
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,status")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "active")) {
      return { ok: false as const, message: "Select an active agency." };
    }

    if (values.property_id) {
      const { data: property, error } = await supabase
        .from("properties")
        .select("id")
        .eq("id", values.property_id)
        .eq("agency_id", agencyId)
        .maybeSingle();
      throwIfError(error);
      if (!property) return { ok: false as const, message: "Select a property from this agency." };
    }
    if (values.source_lead_id) {
      const { data: sourceLead, error } = await supabase
        .from("leads")
        .select("id")
        .eq("id", values.source_lead_id)
        .eq("agency_id", agencyId)
        .maybeSingle();
      throwIfError(error);
      if (!sourceLead) return { ok: false as const, message: "The linked enquiry does not belong to this agency." };
    }
    if (values.assigned_to) {
      const { data: assignee, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", values.assigned_to)
        .eq("agency_id", agencyId)
        .in("role", ["agency_admin", "agent"])
        .eq("is_active", true)
        .maybeSingle();
      throwIfError(error);
      if (!assignee) return { ok: false as const, message: "Assign the lead to an active member of this agency." };
    }

    const { data: lead, error } = await supabase
      .from("loan_leads")
      .insert({
        agency_id: agencyId,
        loan_type: values.loan_type,
        source_lead_id: values.source_lead_id,
        property_id: values.property_id,
        customer_name: values.customer_name,
        phone: values.phone,
        email: values.email.toLowerCase(),
        loan_amount: values.loan_amount,
        monthly_income: values.monthly_income,
        employment_type: values.employment_type,
        city: values.city,
        preferred_bank: values.preferred_bank,
        assigned_to: values.assigned_to,
        notes: values.notes,
      })
      .select("id")
      .single();
    throwIfError(error);
    if (!lead) return { ok: false as const, message: "Unable to create the home-loan request." };
    revalidatePath("/dashboard/home-loans");
    revalidatePath("/dashboard");
    return { ok: true as const, id: lead.id, message: "Home-loan request created." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to create the home-loan request." };
  }
}

export async function updateLoanLead(form: FormData) {
  const user = await requireUser();
  if (!hasAgencyFeature(user, "home_loans")) {
    return { ok: false as const, message: "Home loans are not enabled for your agency." };
  }

  const id = z.string().uuid().safeParse(String(form.get("id") || "").trim());
  const status = z.enum(["new", "docs-collected", "submitted", "sanctioned", "disbursed", "rejected"])
    .safeParse(String(form.get("status") || ""));
  const notes = z.string().trim().max(4000).safeParse(String(form.get("notes") || ""));
  const assignedTo = z.string().trim().uuid().or(z.literal("")).safeParse(String(form.get("assigned_to") || "").trim());
  if (!id.success || !status.success || !notes.success || !assignedTo.success) {
    return { ok: false as const, message: "Check the status, assignee, and notes before saving." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase
      .from("loan_leads")
      .select("id,agency_id")
      .eq("id", id.data)
      .maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) {
      return { ok: false as const, message: "Home-loan lead not found." };
    }
    const assigneeId = assignedTo.data || null;
    if (assigneeId) {
      const { data: assignee, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", assigneeId)
        .eq("agency_id", lead.agency_id)
        .in("role", ["agency_admin", "agent"])
        .eq("is_active", true)
        .maybeSingle();
      throwIfError(error);
      if (!assignee) return { ok: false as const, message: "Assign the lead to an active member of its agency." };
    }

    const { error } = await supabase
      .from("loan_leads")
      .update({ status: status.data, notes: notes.data, assigned_to: assigneeId })
      .eq("id", id.data);
    throwIfError(error);
    revalidatePath("/dashboard/home-loans");
    return { ok: true as const, message: "Home-loan lead updated." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to update the home-loan lead." };
  }
}

export async function verifyLoanDocument(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") {
    return { ok: false as const, message: "Only the platform admin can verify loan documents." };
  }
  const id = z.string().uuid().safeParse(String(form.get("id") || "").trim());
  if (!id.success) return { ok: false as const, message: "Document not found." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: document, error: documentError } = await supabase
      .from("loan_documents")
      .select("id,verified")
      .eq("id", id.data)
      .maybeSingle();
    throwIfError(documentError);
    if (!document) return { ok: false as const, message: "Document not found." };
    if (document.verified) return { ok: true as const, message: "This document is already verified." };

    const { error } = await supabase
      .from("loan_documents")
      .update({ verified: true, verified_by: user.id, verified_at: new Date().toISOString() })
      .eq("id", id.data);
    throwIfError(error);
    revalidatePath("/dashboard/home-loans");
    return { ok: true as const, message: "Document verified." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to verify the loan document." };
  }
}
