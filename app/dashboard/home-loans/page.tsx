import Link from "next/link";
import type { Metadata } from "next";
import { HomeLoansBoard } from "@/components/dashboard/home-loans";
import { PlatformHeader } from "@/components/platform";
import { requireAgencyFeature } from "@/lib/auth";
import type { LoanLead } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

export const metadata: Metadata = { title: "Home-loan pipeline", robots: { index: false, follow: false } };

export default async function HomeLoansPage() {
  const user = await requireAgencyFeature("home_loans");
  const supabase = await createSupabaseServerClient();
  const isAdmin = user.role === "super_admin";

  const [leadsResult, propertiesResult, profilesResult, agenciesResult] = await Promise.all([
    supabase.from("loan_leads").select("*").order("created_at", { ascending: false }),
    (() => {
      const propertiesQuery = supabase.from("properties").select("id,title,agency_id");
      return isAdmin ? propertiesQuery : propertiesQuery.eq("agency_id", user.agency_id || "");
    })(),
    supabase.from("profiles").select("id,name,agency_id").eq("is_active", true).in("role", ["agency_admin", "agent"]),
    supabase.from("agencies").select("id,name"),
  ]);
  const leads = supabaseData(leadsResult.data, leadsResult.error, "Unable to load home-loan leads") as LoanLead[];
  const properties = supabaseData(propertiesResult.data, propertiesResult.error, "Unable to load linked properties");
  const profiles = supabaseData(profilesResult.data, profilesResult.error, "Unable to load agency assignees");
  const agencies = supabaseData(agenciesResult.data, agenciesResult.error, "Unable to load agency names");

  const agencyNames = new Map(agencies.map((agency) => [agency.id, agency.name]));
  const propertyTitles = new Map(properties.map((property) => [property.id, property.title]));
  const assigneeNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const rows = leads.map((lead) => ({
    ...lead,
    agency_name: agencyNames.get(lead.agency_id),
    property_title: lead.property_id ? propertyTitles.get(lead.property_id) : undefined,
    assignee_name: lead.assigned_to ? assigneeNames.get(lead.assigned_to) : undefined,
  }));
  const assignees = profiles.map((profile) => ({ id: profile.id, name: profile.name, agency_id: profile.agency_id }));

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <div className="workspace-title">
          <div>
            <p className="kicker">FINANCING WORKSPACE</p>
            <h1>Home-loan <em>pipeline.</em></h1>
            <p className="muted">{isAdmin ? "Review and manage requests across every agency." : "Track each request and keep applications moving."}</p>
          </div>
          <Link className="btn" href="/dashboard/home-loans/new">+ Request home loan</Link>
        </div>
        <HomeLoansBoard leads={rows} assignees={assignees} isAdmin={isAdmin} />
      </main>
    </>
  );
}
