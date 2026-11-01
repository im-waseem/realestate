import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/lib/db";

export async function currentUser(): Promise<User | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error(`Unable to verify the Supabase session: ${authError.message}`);
  }
  if (!authData.user) return undefined;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,name,email,role,agency_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Unable to load the account profile: ${profileError.message}`);
  if (!profile || !["super_admin", "agency_admin", "agent"].includes(profile.role)) return undefined;

  let agencyStatus: string | undefined;
  if (profile.agency_id) {
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("status")
      .eq("id", profile.agency_id)
      .maybeSingle();
    if (agencyError) throw new Error(`Unable to load the agency status: ${agencyError.message}`);
    agencyStatus = agency?.status;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    agency_id: profile.agency_id,
    agency_status: agencyStatus,
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin" && user.agency_status !== "active") {
    redirect("/login?message=Your+agency+is+suspended+or+unavailable.");
  }
  return user;
}
