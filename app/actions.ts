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
import { canAgencyEditLoanLead } from "@/lib/loan-leads/access";
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
const agencyRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  agency: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().regex(/^[+\d ()-]{7,25}$/),
  password: z.string().min(12).max(128),
  rera_agent_number: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9/-]+$/),
  rera_state: z.string().trim().min(2).max(100),
  certificate: z.instanceof(File),
});
const agencyDecisionSchema = z.object({
  agency_id: z.string().trim().min(1).max(100),
  decision: z.enum(["approve", "reject", "suspend", "reactivate"]),
  reason: z.string().trim().max(1000),
});
const loanTypeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,49}$/),
  name: z.string().trim().min(2).max(100),
  sort_order: z.coerce.number().int().min(0).max(100000),
  is_active: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const lenderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  lender_type: z.enum(["bank", "nbfc", "hfc"]),
  is_active: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const commissionRuleSchema = z.object({
  id: z.string().uuid().optional(),
  loan_type_id: z.string().uuid(),
  lender_id: z.string().uuid().optional().or(z.literal("")),
  agency_id: z.string().trim().max(100).optional().or(z.literal("")),
  basis: z.enum(["percent", "flat"]),
  percent: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(100).optional()),
  flat_amount: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(999999999999.99).optional()),
  minimum_commission: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(999999999999.99).optional()),
  maximum_commission: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(999999999999.99).optional()),
  agency_share_percent: z.coerce.number().finite().min(0).max(100),
  effective_from: z.string().date(),
  effective_to: z.string().date().optional().or(z.literal("")),
  is_active: z.enum(["true", "false"]).transform((value) => value === "true"),
}).superRefine((value, context) => {
  if (value.basis === "percent" && value.percent === undefined) context.addIssue({ code: "custom", path: ["percent"], message: "Enter the commission percentage." });
  if (value.basis === "flat" && value.flat_amount === undefined) context.addIssue({ code: "custom", path: ["flat_amount"], message: "Enter the flat commission amount." });
  if (value.minimum_commission !== undefined && value.maximum_commission !== undefined && value.minimum_commission > value.maximum_commission) context.addIssue({ code: "custom", path: ["maximum_commission"], message: "Maximum must be at least the minimum." });
  if (value.effective_to && value.effective_to < value.effective_from) context.addIssue({ code: "custom", path: ["effective_to"], message: "End date must be on or after the start date." });
});
const agencyLoanLeadSchema = z.object({
  id: z.string().uuid().optional(),
  loan_type: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/),
  customer_name: z.string().trim().min(2).max(100),
  first_name: z.string().trim().max(80).default(""),
  middle_name: z.string().trim().max(80).default(""),
  mother_name: z.string().trim().max(150).default(""),
  father_name: z.string().trim().max(150).default(""),
  date_of_birth: z.string().date().optional().or(z.literal("")),
  pincode: z.string().trim().regex(/^$|^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code."),
  applicant_address: z.string().trim().max(500),
  phone: z.string().trim().regex(/^[+\d ()-]{7,25}$/),
  email: z.string().trim().email().max(254),
  city: z.string().trim().min(1).max(100),
  employment_type: z.enum(["salaried", "self_employed", "business_owner", "other"]),
  monthly_income: z.coerce.number().finite().min(0.01).max(999999999999.99),
  loan_amount: z.coerce.number().finite().min(0.01).max(999999999999.99),
  tenure_months: z.coerce.number().int().min(1).max(600),
  property_id: z.string().trim().max(100).optional().or(z.literal("")),
  source_lead_id: z.string().trim().max(100).optional().or(z.literal("")),
  preferred_lender_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(4000),
  consent: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const adminLoanUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted_to_admin", "info_requested", "under_review", "sanctioned", "disbursed", "rejected", "cancelled"]),
  admin_remarks: z.string().trim().max(4000),
  assigned_lender_id: z.string().uuid().optional().or(z.literal("")),
  sanctioned_amount: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(999999999999.99).optional()),
  sanctioned_at: z.string().date().optional().or(z.literal("")),
  disbursed_amount: z.preprocess((value) => value === "" || value == null ? undefined : Number(value), z.number().finite().min(0).max(999999999999.99).optional()),
  disbursed_at: z.string().date().optional().or(z.literal("")),
});
const loanCreateSchema = z.object({
  agency_id: z.string().trim().min(1).max(100),
  loan_type: z.string().trim().min(2).max(50),
  source_lead_id: loanOptionalText,
  property_id: loanOptionalText,
  customer_name: z.string().trim().min(1).max(100),
  first_name: z.string().trim().max(80).default(""),
  middle_name: z.string().trim().max(80).default(""),
  mother_name: z.string().trim().max(150).default(""),
  father_name: z.string().trim().max(150).default(""),
  date_of_birth: z.string().trim().date().optional().or(z.literal("")),
  pincode: z.string().trim().regex(/^$|^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code."),
  applicant_address: z.string().trim().max(500).default(""),
  phone: z.string().trim().regex(/^[+\d ()-]{7,25}$/, "Enter a valid phone number."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
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
    first_name: String(form.get("first_name") || ""),
    middle_name: String(form.get("middle_name") || ""),
    mother_name: String(form.get("mother_name") || ""),
    father_name: String(form.get("father_name") || ""),
    date_of_birth: String(form.get("date_of_birth") || ""),
    pincode: String(form.get("pincode") || ""),
    applicant_address: String(form.get("applicant_address") || ""),
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
  let agencyNeedsReview = false;
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
      .select("id,agency_id,role,is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    throwIfError(profileError);
    if (!profile || !profile.is_active || !["super_admin", "agency_admin", "agent"].includes(profile.role)) {
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
      agencyNeedsReview = agency?.status !== "approved";
    }
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    redirect(`/login?message=${message}&next=${encodeURIComponent(nextPath)}`);
  }
  if (agencyNeedsReview) redirect("/dashboard");
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
    const parsed = agencyRegistrationSchema.safeParse({
      name: form.get("name"),
      agency: form.get("agency"),
      email: form.get("email"),
      phone: form.get("phone"),
      password: form.get("password"),
      rera_agent_number: form.get("rera_agent_number"),
      rera_state: form.get("rera_state"),
      certificate: form.get("rera_certificate"),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Check the agency registration details.");
    const { name, agency: agencyName, email: emailAddress, phone, password: newPassword, rera_agent_number: reraAgentNumber, rera_state: reraState, certificate } = parsed.data;
    if (certificate.size < 1 || certificate.size > 5 * 1024 * 1024) throw new Error("RERA certificate must be no larger than 5 MB.");
    const certificateExtension = certificate.name.toLowerCase().endsWith(".pdf") ? "pdf" :
      /\.jpe?g$/i.test(certificate.name) ? "jpg" : "";
    if (!certificateExtension || !["application/pdf", "image/jpeg"].includes(certificate.type)) {
      throw new Error("Upload a PDF or JPG RERA certificate.");
    }
    const certificateBytes = Buffer.from(await certificate.arrayBuffer());
    const validCertificate = certificateExtension === "pdf"
      ? certificateBytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : certificateBytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    if (!validCertificate) throw new Error("The certificate file contents do not match its PDF or JPG type.");

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

    const agencyId = randomUUID();
    const certificatePath = `${agencyId}/rera-certificate.${certificateExtension}`;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: emailAddress,
      password: newPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    throwIfError(authError);
    if (!authData.user) throw new Error("Unable to create the account.");

    const { error: certificateError } = await admin.storage.from("agency-rera-documents").upload(certificatePath, certificateBytes, {
      contentType: certificateExtension === "pdf" ? "application/pdf" : "image/jpeg",
      cacheControl: "0",
      upsert: false,
    });
    if (certificateError) await rollbackRegistration(admin, authData.user.id, agencyId, certificateError.message);
    const { error: agencyError } = await admin.from("agencies").insert({
      id: agencyId,
      name: agencyName,
      status: "pending",
      contact_name: name,
      contact_email: emailAddress,
      phone,
      rera_agent_number: reraAgentNumber,
      rera_state: reraState,
      rera_certificate_path: certificatePath,
    });
    if (agencyError) {
      await admin.storage.from("agency-rera-documents").remove([certificatePath]);
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
      await admin.storage.from("agency-rera-documents").remove([certificatePath]);
      await rollbackRegistration(admin, authData.user.id, agencyId, profileError.message);
    }
    const { error: activityError } = await admin.from("activity").insert({
      id: randomUUID(),
      agency_id: agencyId,
      actor: name,
      action: "Registered agency and is awaiting admin approval",
    });
    if (activityError) {
      await admin.storage.from("agency-rera-documents").remove([certificatePath]);
      await rollbackRegistration(admin, authData.user.id, agencyId, activityError.message);
    }
  } catch (error) {
    fail("/register", error);
  }
  redirect("/login?message=Registration+submitted.+Your+agency+will+be+available+after+admin+approval.");
}

export async function decideAgencyApproval(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard/admin/agencies", new Error("Only the platform admin can review agencies."));
  const parsed = agencyDecisionSchema.safeParse({
    agency_id: String(form.get("agency_id") || ""),
    decision: String(form.get("decision") || ""),
    reason: String(form.get("reason") || ""),
  });
  if (!parsed.success) fail("/dashboard/admin/agencies", new Error(parsed.error.issues[0]?.message || "Invalid agency decision."));
  const { agency_id: agencyId, decision, reason } = parsed.data;
  if (decision === "reject" && !reason) fail("/dashboard/admin/agencies", new Error("A reason is required when rejecting an agency."));

  try {
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,name,status").eq("id", agencyId).maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    if (decision === "approve" && !["pending", "rejected"].includes(agency.status)) throw new Error("Only pending or rejected agencies can be approved.");
    if (decision === "reject" && agency.status !== "pending") throw new Error("Only pending agencies can be rejected.");
    if (decision === "suspend" && agency.status !== "approved") throw new Error("Only approved agencies can be suspended.");
    if (decision === "reactivate" && agency.status !== "suspended") throw new Error("Only suspended agencies can be reactivated.");

    const values = decision === "approve" || decision === "reactivate"
      ? { status: "approved", approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: "", is_active: true }
      : decision === "reject"
        ? { status: "rejected", approved_by: null, approved_at: null, rejection_reason: reason, is_active: false }
        : { status: "suspended", is_active: false };
    const { error } = await supabase.from("agencies").update(values).eq("id", agencyId);
    throwIfError(error);
    await recordActivity(agencyId, user.name, `${decision} agency ${agency.name}${decision === "reject" ? `: ${reason}` : ""}`);
  } catch (error) {
    fail("/dashboard/admin/agencies", error);
  }
  revalidatePath("/dashboard/admin/agencies");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function verifyAgencyRera(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard/admin/agencies", new Error("Only the platform admin can verify RERA details."));
  const agencyId = z.string().trim().min(1).max(100).safeParse(String(form.get("agency_id") || ""));
  if (!agencyId.success) fail("/dashboard/admin/agencies", new Error("Agency not found."));
  try {
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies")
      .select("id,name,rera_agent_number,rera_state,rera_certificate_path")
      .eq("id", agencyId.data).maybeSingle();
    throwIfError(agencyError);
    if (!agency || !agency.rera_agent_number || !agency.rera_state || !agency.rera_certificate_path) {
      throw new Error("RERA number, state, and certificate must be present before verification.");
    }
    const { error } = await supabase.from("agencies").update({
      rera_verified: true,
      rera_verified_by: user.id,
      rera_verified_at: new Date().toISOString(),
    }).eq("id", agencyId.data);
    throwIfError(error);
    await recordActivity(agencyId.data, user.name, `Verified RERA details for ${agency.name}`);
  } catch (error) {
    fail("/dashboard/admin/agencies", error);
  }
  revalidatePath("/dashboard/admin/agencies");
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
    if (!agency || (user.role !== "super_admin" && agency.status !== "approved")) throw new Error("Select an approved agency.");
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
    if (!agency || (user.role !== "super_admin" && agency.status !== "approved")) {
      throw new Error("Your agency workspace is not approved.");
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
  const returnToApprovals = form.get("return_to") === "/dashboard/admin/agencies";
  try {
    const agencyId = field(form, "agency_id", 100);
    const feature = choice(form, "feature", ["home_loans", "loans", "tools"] as const);
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
  revalidatePath("/dashboard/admin/agencies");
  if (!returnToApprovals) redirect("/dashboard#agencies");
}

export async function updateAgencyLoanProduct(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency loan products."));
  let agencyId = "";
  const returnTo = safeReturnPath(form.get("return_to"));
  try {
    agencyId = field(form, "agency_id", 100);
    const loanType = z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/).parse(field(form, "loan_type", 50));
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
    features.loans = (enabledRows || []).length > 0;
    const { error: featureError } = await supabase.from("agencies").update({ features }).eq("id", agencyId);
    throwIfError(featureError);
    await recordActivity(agencyId, user.name, `${enabled ? "Enabled" : "Disabled"} ${loanType.replaceAll("_", " ")}`);
  } catch (error) {
    fail(returnTo === "/dashboard/admin/loans" ? returnTo : "/dashboard", error);
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/home-loans");
  revalidatePath("/dashboard/admin/loans");
  if (returnTo === "/dashboard/admin/loans") redirect(returnTo);
  redirect("/dashboard#loans");
}

export async function updateAgencyLoanFields(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard/admin/loans", new Error("Only the main admin can change loan intake fields."));
  const agencyId = field(form, "agency_id", 100);
  const allowed = ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"] as const;
  const enabledFields = allowed.filter((key) => form.get(key) === "on");
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("agency_loan_field_settings").upsert({ agency_id: agencyId, enabled_fields: enabledFields }, { onConflict: "agency_id" });
    throwIfError(error);
    await recordActivity(agencyId, user.name, "Updated loan applicant data collection settings");
  } catch (error) {
    fail("/dashboard/admin/loans", error);
  }
  revalidatePath("/dashboard/admin/loans");
  revalidatePath("/dashboard/home-loans/new");
  redirect("/dashboard/admin/loans?settings=updated");
}

function loanSettingsError(tab: string, error: unknown): never {
  const message = encodeURIComponent(error instanceof Error ? error.message : "Unable to save loan settings.");
  redirect(`/dashboard/admin/loan-settings?tab=${tab}&message=${message}`);
}

export async function saveLoanType(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") loanSettingsError("types", new Error("Only the platform admin can edit loan types."));
  const parsed = loanTypeSchema.safeParse({
    id: String(form.get("id") || "") || undefined,
    code: String(form.get("code") || ""),
    name: String(form.get("name") || ""),
    sort_order: form.get("sort_order"),
    is_active: String(form.get("is_active") || "true"),
  });
  if (!parsed.success) loanSettingsError("types", new Error(parsed.error.issues[0]?.message || "Invalid loan type."));
  const { id, ...values } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const result = id
    ? await supabase.from("loan_types").update(values).eq("id", id)
    : await supabase.from("loan_types").insert(values);
  if (result.error) loanSettingsError("types", new Error(result.error.message));
  revalidatePath("/dashboard/admin/loan-settings");
  redirect("/dashboard/admin/loan-settings?tab=types&message=Loan+type+saved");
}

export async function saveLender(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") loanSettingsError("lenders", new Error("Only the platform admin can edit lenders."));
  const parsed = lenderSchema.safeParse({
    id: String(form.get("id") || "") || undefined,
    name: String(form.get("name") || ""),
    lender_type: String(form.get("lender_type") || ""),
    is_active: String(form.get("is_active") || "true"),
  });
  if (!parsed.success) loanSettingsError("lenders", new Error(parsed.error.issues[0]?.message || "Invalid lender."));
  const { id, ...values } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const result = id
    ? await supabase.from("lenders").update(values).eq("id", id)
    : await supabase.from("lenders").insert(values);
  if (result.error) loanSettingsError("lenders", new Error(result.error.message));
  revalidatePath("/dashboard/admin/loan-settings");
  redirect("/dashboard/admin/loan-settings?tab=lenders&message=Lender+saved");
}

export async function saveCommissionRule(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") loanSettingsError("rules", new Error("Only the platform admin can edit commission rules."));
  const parsed = commissionRuleSchema.safeParse({
    id: String(form.get("id") || "") || undefined,
    loan_type_id: String(form.get("loan_type_id") || ""),
    lender_id: String(form.get("lender_id") || ""),
    agency_id: String(form.get("agency_id") || ""),
    basis: String(form.get("basis") || ""),
    percent: form.get("percent"),
    flat_amount: form.get("flat_amount"),
    minimum_commission: form.get("minimum_commission"),
    maximum_commission: form.get("maximum_commission"),
    agency_share_percent: form.get("agency_share_percent"),
    effective_from: String(form.get("effective_from") || ""),
    effective_to: String(form.get("effective_to") || ""),
    is_active: String(form.get("is_active") || "true"),
  });
  if (!parsed.success) loanSettingsError("rules", new Error(parsed.error.issues[0]?.message || "Invalid commission rule."));
  const { id, basis, percent, flat_amount, lender_id, agency_id, effective_to, ...rest } = parsed.data;
  const values = {
    ...rest,
    basis,
    percent: basis === "percent" ? percent ?? null : null,
    flat_amount: basis === "flat" ? flat_amount ?? null : null,
    lender_id: lender_id || null,
    agency_id: agency_id || null,
    minimum_commission: rest.minimum_commission ?? null,
    maximum_commission: rest.maximum_commission ?? null,
    effective_to: effective_to || null,
  };
  const supabase = await createSupabaseServerClient();
  const result = id
    ? await supabase.from("commission_rules").update(values).eq("id", id)
    : await supabase.from("commission_rules").insert(values);
  if (result.error) loanSettingsError("rules", new Error(result.error.message));
  revalidatePath("/dashboard/admin/loan-settings");
  redirect("/dashboard/admin/loan-settings?tab=rules&message=Commission+rule+saved");
}

export async function setAgencyStatus(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") fail("/dashboard", new Error("Only the main admin can change agency status."));
  try {
    const id = field(form, "agency_id", 100);
    const status = choice(form, "status", ["approved", "suspended"]);
    const supabase = await createSupabaseServerClient();
    const { data: agency, error: agencyError } = await supabase.from("agencies").select("id,name,status").eq("id", id).maybeSingle();
    throwIfError(agencyError);
    if (!agency) throw new Error("Agency not found.");
    const { error } = await supabase.from("agencies").update(status === "approved"
      ? { status, approved_by: user.id, approved_at: new Date().toISOString(), rejection_reason: "", is_active: true }
      : { status, is_active: false }).eq("id", id);
    throwIfError(error);
    const action = status === "approved"
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
      .update({ is_active: active, status: active ? "approved" : "suspended" })
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
    const admin = createSupabaseAdminClient();
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
    const { data: loanDocuments, error: loanDocumentsError } = await admin
      .from("loan_documents")
      .select("file_path")
      .eq("agency_id", id);
    throwIfError(loanDocumentsError);
    if ((loanDocuments ?? []).length) {
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
    if (!agency || (user.role !== "super_admin" && agency.status !== "approved")) throw new Error("Select an approved agency.");
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
    if (!agency || (user.role !== "super_admin" && agency.status !== "approved")) throw new Error("Select an approved agency.");

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
    const { data: fieldSettings, error: fieldSettingsError } = await supabase.from("agency_loan_field_settings").select("enabled_fields").eq("agency_id", agencyId).maybeSingle();
    throwIfError(fieldSettingsError);
    const enabledFields = new Set<string>(fieldSettings?.enabled_fields || ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"]);
    for (const key of ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"] as const) {
      if (!enabledFields.has(key) && values[key]) return { ok: false as const, message: `${key.replaceAll("_", " ")} is not collected by this agency.` };
    }
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id,status")
      .eq("id", agencyId)
      .maybeSingle();
    throwIfError(agencyError);
    if (!agency || (user.role !== "super_admin" && agency.status !== "approved")) {
      return { ok: false as const, message: "Select an approved agency." };
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
        customer_name: [values.first_name, values.middle_name].filter(Boolean).join(" ") || "Applicant",
        first_name: enabledFields.has("first_name") ? values.first_name : "",
        middle_name: enabledFields.has("middle_name") ? values.middle_name : "",
        mother_name: enabledFields.has("mother_name") ? values.mother_name : "",
        father_name: enabledFields.has("father_name") ? values.father_name : "",
        date_of_birth: enabledFields.has("date_of_birth") ? values.date_of_birth || null : null,
        pincode: enabledFields.has("pincode") ? values.pincode : "",
        applicant_address: enabledFields.has("applicant_address") ? values.applicant_address : "",
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
  const status = z.enum(["draft", "info_requested", "submitted_to_admin", "under_review", "sanctioned", "disbursed", "rejected", "cancelled"])
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
      .select("id,agency_id,customer_name,status,notes,assigned_to")
      .eq("id", id.data)
      .maybeSingle();
    throwIfError(leadError);
    if (!lead || (user.role !== "super_admin" && lead.agency_id !== user.agency_id)) {
      return { ok: false as const, message: "Home-loan lead not found." };
    }
    if (user.role !== "super_admin") {
      return { ok: false as const, message: "Use the loan lead form to edit drafts; only the platform admin can update the review pipeline." };
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
    const changes = [
      lead.status !== status.data ? `status ${lead.status} â†’ ${status.data}` : "",
      lead.notes !== notes.data ? "notes updated" : "",
      lead.assigned_to !== assigneeId ? "assignee changed" : "",
    ].filter(Boolean);
    if (user.role !== "super_admin" && changes.length) {
      await recordActivity(lead.agency_id, user.name, `Updated home-loan request: ${lead.customer_name} (${changes.join(", ")})`);
    }
    revalidatePath("/dashboard/home-loans");
    revalidatePath("/dashboard");
    return { ok: true as const, message: changes.length
      ? "Home-loan lead updated. The platform admin can see it in the Loans activity feed."
      : "No loan details changed." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to update the home-loan lead." };
  }
}

async function recordLoanLeadHistory(lead: { id: string; agency_id: string }, user: Awaited<ReturnType<typeof requireUser>>, eventType: string, fromStatus: string | null, toStatus: string | null, remark = "") {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("loan_lead_history").insert({
    loan_lead_id: lead.id,
    agency_id: lead.agency_id,
    actor_id: user.id,
    actor_name: user.name,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    remark,
  });
  throwIfError(error);
}

export async function saveAgencyLoanLead(form: FormData) {
  const user = await requireUser();
  if (user.role === "super_admin" || !hasAgencyFeature(user, "loans") || !user.agency_id) {
    return { ok: false as const, message: "Loan applications are not enabled for this agency." };
  }
  const id = String(form.get("id") || "").trim();
  const parsed = agencyLoanLeadSchema.safeParse({
    id: id || undefined,
    loan_type: String(form.get("loan_type") || ""),
    customer_name: String(form.get("customer_name") || ""),
    first_name: String(form.get("first_name") || ""),
    middle_name: String(form.get("middle_name") || ""),
    mother_name: String(form.get("mother_name") || ""),
    father_name: String(form.get("father_name") || ""),
    date_of_birth: String(form.get("date_of_birth") || ""),
    pincode: String(form.get("pincode") || ""),
    applicant_address: String(form.get("applicant_address") || ""),
    phone: String(form.get("phone") || ""),
    email: String(form.get("email") || ""),
    city: String(form.get("city") || ""),
    employment_type: String(form.get("employment_type") || ""),
    monthly_income: form.get("monthly_income"),
    loan_amount: form.get("loan_amount"),
    tenure_months: form.get("tenure_months"),
    property_id: String(form.get("property_id") || ""),
    source_lead_id: String(form.get("source_lead_id") || ""),
    preferred_lender_id: String(form.get("preferred_lender_id") || ""),
    notes: String(form.get("notes") || ""),
    consent: String(form.get("consent") || "false"),
  });
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message || "Check the loan details." };
  if (!parsed.data.consent) return { ok: false as const, message: "Customer consent is required before sending the request to the platform admin." };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: fieldSettings, error: fieldSettingsError } = await supabase.from("agency_loan_field_settings").select("enabled_fields").eq("agency_id", user.agency_id).maybeSingle();
    throwIfError(fieldSettingsError);
    const enabledFields = new Set<string>(fieldSettings?.enabled_fields || ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"]);
    for (const key of ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"] as const) {
      if (!enabledFields.has(key) && parsed.data[key]) return { ok: false as const, message: `${key.replaceAll("_", " ")} is disabled for your agency.` };
      if (enabledFields.has(key) && !parsed.data[key]) return { ok: false as const, message: `Provide ${key.replaceAll("_", " ")} or ask your admin to disable that field.` };
    }
    let existing: { id: string; agency_id: string; status: string } | null = null;
    if (parsed.data.id) {
      const result = await supabase.from("loan_leads").select("id,agency_id,status")
        .eq("id", parsed.data.id).eq("agency_id", user.agency_id).maybeSingle();
      throwIfError(result.error);
      existing = result.data;
      if (!existing || !canAgencyEditLoanLead(user, existing)) return { ok: false as const, message: "Loan request not found or is locked." };
    }

    const { data: loanType, error: loanTypeError } = await supabase.from("loan_types")
      .select("code").eq("code", parsed.data.loan_type).eq("is_active", true).maybeSingle();
    throwIfError(loanTypeError);
    if (!loanType) return { ok: false as const, message: "Select an active loan type." };

    if (parsed.data.property_id) {
      const { data, error } = await supabase.from("properties").select("id").eq("id", parsed.data.property_id).eq("agency_id", user.agency_id).maybeSingle();
      throwIfError(error);
      if (!data) return { ok: false as const, message: "Select a property from your agency." };
    }
    if (parsed.data.source_lead_id) {
      const { data, error } = await supabase.from("leads").select("id").eq("id", parsed.data.source_lead_id).eq("agency_id", user.agency_id).maybeSingle();
      throwIfError(error);
      if (!data) return { ok: false as const, message: "Select an enquiry from your agency." };
    }
    if (parsed.data.preferred_lender_id) {
      const { data, error } = await supabase.from("lenders").select("id").eq("id", parsed.data.preferred_lender_id).eq("is_active", true).maybeSingle();
      throwIfError(error);
      if (!data) return { ok: false as const, message: "Select an active lender." };
    }

    const values = {
      loan_type: parsed.data.loan_type,
      customer_name: [parsed.data.first_name, parsed.data.middle_name].filter(Boolean).join(" ") || "Applicant",
      first_name: enabledFields.has("first_name") ? parsed.data.first_name : "",
      middle_name: enabledFields.has("middle_name") ? parsed.data.middle_name : "",
      mother_name: enabledFields.has("mother_name") ? parsed.data.mother_name : "",
      father_name: enabledFields.has("father_name") ? parsed.data.father_name : "",
      date_of_birth: enabledFields.has("date_of_birth") ? parsed.data.date_of_birth || null : null,
      pincode: enabledFields.has("pincode") ? parsed.data.pincode : "",
      applicant_address: enabledFields.has("applicant_address") ? parsed.data.applicant_address : "",
      phone: parsed.data.phone,
      email: parsed.data.email.toLowerCase(),
      city: parsed.data.city,
      employment_type: parsed.data.employment_type,
      monthly_income: parsed.data.monthly_income,
      loan_amount: parsed.data.loan_amount,
      tenure_months: parsed.data.tenure_months,
      property_id: parsed.data.property_id || null,
      source_lead_id: parsed.data.source_lead_id || null,
      preferred_lender_id: parsed.data.preferred_lender_id || null,
      notes: parsed.data.notes,
      consent: parsed.data.consent,
    };
    let loanId = parsed.data.id;
    if (existing) return { ok: false as const, message: "Loan requests cannot be edited here. Send a new request or contact the platform admin." };
    loanId = randomUUID();
    const { error: insertError } = await supabase.from("loan_leads").insert({
      ...values,
      id: loanId,
      agency_id: user.agency_id,
      created_by: user.id,
      status: "draft",
    });
    throwIfError(insertError);
    const { error: submitError } = await supabase.from("loan_leads").update({ status: "submitted_to_admin", consent: true })
      .eq("id", loanId).eq("agency_id", user.agency_id);
    throwIfError(submitError);
    const timelineLead = { id: loanId!, agency_id: user.agency_id };
    await recordLoanLeadHistory(timelineLead, user, "submitted", null, "submitted_to_admin");
    await recordActivity(user.agency_id, user.name, `Submitted loan request for admin review: ${values.customer_name}`);
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/admin/loans");
    revalidatePath("/dashboard");
    redirect(`/dashboard/loans/${loanId}?message=Sent+to+admin+for+review`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to send loan request to the platform admin." };
  }
}

export async function submitAgencyLoanLead(form: FormData) {
  const user = await requireUser();
  if (user.role === "super_admin" || !hasAgencyFeature(user, "loans") || !user.agency_id) {
    return { ok: false as const, message: "Loan applications are not enabled for this agency." };
  }
  const id = z.string().uuid().safeParse(String(form.get("id") || "").trim());
  const consent = String(form.get("consent") || "") === "on";
  if (!id.success || !consent) return { ok: false as const, message: "Consent is required before submitting to the platform admin." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("loan_leads")
      .select("id,agency_id,status,customer_name,first_name,middle_name,mother_name,father_name,date_of_birth,pincode,applicant_address,phone,email,city,loan_amount,monthly_income,tenure_months,consent")
      .eq("id", id.data).eq("agency_id", user.agency_id).maybeSingle();
    throwIfError(leadError);
    if (!lead) return { ok: false as const, message: "Loan request not found." };
    if (!["draft", "info_requested"].includes(lead.status)) return { ok: false as const, message: "This loan request has already been submitted and is locked." };
    const { data: fieldSettings, error: settingsError } = await supabase.from("agency_loan_field_settings").select("enabled_fields").eq("agency_id", user.agency_id).maybeSingle();
    throwIfError(settingsError);
    const enabledFields = new Set<string>(fieldSettings?.enabled_fields || ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"]);
    const missingEnabledField = ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"].find((key) => enabledFields.has(key) && !lead[key as keyof typeof lead]);
    if (missingEnabledField) return { ok: false as const, message: `Complete ${missingEnabledField.replaceAll("_", " ")} before submitting.` };
    if (!lead.phone || !lead.email || !lead.city || !lead.loan_amount || !lead.monthly_income || !lead.tenure_months) {
      return { ok: false as const, message: "Complete the required loan details before submitting." };
    }
    const { error } = await supabase.from("loan_leads").update({ status: "submitted_to_admin", consent: true }).eq("id", id.data).eq("agency_id", user.agency_id);
    throwIfError(error);
    await recordLoanLeadHistory({ id: lead.id, agency_id: lead.agency_id }, user, "submitted", lead.status, "submitted_to_admin");
    await recordActivity(lead.agency_id, user.name, `Submitted loan request for admin review: ${lead.customer_name}`);
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/admin/loans");
    redirect(`/dashboard/loans/${id.data}?message=Submitted+to+admin+for+review`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to submit loan request." };
  }
}

export async function updateAdminLoanLead(form: FormData) {
  const user = await requireUser();
  if (user.role !== "super_admin") return { ok: false as const, message: "Only the platform admin can review loan requests." };
  const parsed = adminLoanUpdateSchema.safeParse({
    id: String(form.get("id") || ""),
    status: String(form.get("status") || ""),
    admin_remarks: String(form.get("admin_remarks") || ""),
    assigned_lender_id: String(form.get("assigned_lender_id") || ""),
    sanctioned_amount: form.get("sanctioned_amount"),
    sanctioned_at: String(form.get("sanctioned_at") || ""),
    disbursed_amount: form.get("disbursed_amount"),
    disbursed_at: String(form.get("disbursed_at") || ""),
  });
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message || "Check the review fields." };
  const value = parsed.data;
  if (["info_requested", "rejected"].includes(value.status) && !value.admin_remarks) {
    return { ok: false as const, message: value.status === "info_requested" ? "Add a remark describing the information needed." : "Add a reason before rejecting this request." };
  }
  if (value.status === "disbursed" && (value.disbursed_amount === undefined || value.disbursed_amount <= 0 || !value.disbursed_at)) {
    return { ok: false as const, message: "Enter a positive disbursed amount and date." };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: lead, error: leadError } = await supabase.from("loan_leads").select("id,agency_id,status,customer_name")
      .eq("id", value.id).maybeSingle();
    throwIfError(leadError);
    if (!lead) return { ok: false as const, message: "Loan request not found." };
    if (value.assigned_lender_id) {
      const { data: lender, error } = await supabase.from("lenders").select("id").eq("id", value.assigned_lender_id).eq("is_active", true).maybeSingle();
      throwIfError(error);
      if (!lender) return { ok: false as const, message: "Select an active lender." };
    }
    const { error } = await supabase.from("loan_leads").update({
      status: value.status,
      admin_remarks: value.admin_remarks,
      assigned_lender_id: value.assigned_lender_id || null,
      sanctioned_amount: value.sanctioned_amount ?? null,
      sanctioned_at: value.sanctioned_at || null,
      disbursed_amount: value.disbursed_amount ?? null,
      disbursed_at: value.disbursed_at || null,
    }).eq("id", value.id);
    throwIfError(error);
    const eventType = lead.status !== value.status ? "status_changed" : "updated";
    await recordLoanLeadHistory({ id: lead.id, agency_id: lead.agency_id }, user, eventType, lead.status, value.status, value.admin_remarks);
    await recordActivity(lead.agency_id, user.name, `Reviewed loan request for ${lead.customer_name}: ${value.status}`);
    revalidatePath("/dashboard/admin/loans");
    revalidatePath(`/dashboard/admin/loans/${value.id}`);
    revalidatePath("/dashboard/loans");
    return { ok: true as const, message: "Loan request updated." };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Unable to update loan request." };
  }
}
