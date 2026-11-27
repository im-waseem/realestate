import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/lib/db";
import { hasAgencyFeature, normalizeAgencyFeatures, type AgencyFeature } from "@/lib/features";

export async function currentUser(): Promise<User | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the Supabase session: ${authError.message}`);
  }
  if (!authData.user) return undefined;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,name,email,role,agency_id,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    if (/column profiles\.is_active does not exist/i.test(profileError.message)) {
      throw new Error("The database is missing profiles.is_active. Apply sql/migrations/20261125_agency_feature_flags.sql to the Supabase project configured for this app.");
    }
    throw new Error(`Unable to load the account profile: ${profileError.message}`);
  }
  if (!profile || !profile.is_active || !["super_admin", "agency_admin", "agent"].includes(profile.role)) return undefined;

  let agencyStatus: string | undefined;
  let features = normalizeAgencyFeatures(undefined);
  if (profile.agency_id) {
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("status,features")
      .eq("id", profile.agency_id)
      .maybeSingle();
    if (agencyError) {
      if (/column agencies\.features does not exist/i.test(agencyError.message)) {
        throw new Error("The database is missing agencies.features. Apply sql/migrations/20261125_agency_feature_flags.sql to the Supabase project configured for this app.");
      }
      throw new Error(`Unable to load agency settings: ${agencyError.message}`);
    }
    agencyStatus = agency?.status;
    features = normalizeAgencyFeatures(agency?.features);
    if (!features.loans) {
      const { count, error: productsError } = await supabase
        .from("agency_loan_products")
        .select("loan_type", { count: "exact", head: true })
        .eq("agency_id", profile.agency_id)
        .eq("enabled", true);
      if (productsError) {
        if (/agency_loan_products|relation .* does not exist/i.test(productsError.message)) {
          throw new Error("The database is missing agency loan products. Apply sql/migrations/20261130_agency_loan_products.sql and the latest loan access migration.");
        }
        throw new Error(`Unable to load agency loan access: ${productsError.message}`);
      }
      features.loans = (count || 0) > 0;
    }
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    agency_id: profile.agency_id,
    agency_status: agencyStatus,
    features,
  };
}

export async function requireAgencyFeature(feature: AgencyFeature) {
  const user = await requireUser();
  if (!hasAgencyFeature(user, feature)) notFound();
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/no-access");
  if (user.role !== "super_admin" && user.agency_status !== "approved") {
    redirect("/dashboard");
  }
  return user;
}
