import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyTable } from "@/components/dashboard/property-table";
import { PlatformHeader } from "@/components/platform";
import { requireUser } from "@/lib/auth";
import type { Property } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import type { Metadata } from "next";

type AgencyProperty = Property & { lead_count: number };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Properties" };

export default async function AgencyProperties() {
  const user = await requireUser();
  if (user.role === "super_admin" || !user.agency_id) notFound();
  const supabase = await createSupabaseServerClient();
  const [propertyResult, leadResult] = await Promise.all([
    supabase.from("properties").select("*").eq("agency_id", user.agency_id).order("created_at", { ascending: false }),
    supabase.from("leads").select("property_id").eq("agency_id", user.agency_id),
  ]);
  const leadCounts = new Map<string, number>();
  for (const lead of supabaseData(leadResult.data, leadResult.error, "Unable to load enquiries")) {
    if (lead.property_id) leadCounts.set(lead.property_id, (leadCounts.get(lead.property_id) || 0) + 1);
  }
  const properties: AgencyProperty[] = supabaseData(propertyResult.data, propertyResult.error, "Unable to load properties")
    .map((property) => ({ ...property, lead_count: leadCounts.get(property.id) || 0 }));
  return <>
    <PlatformHeader />
    <main className="workspace dashboard">
      <p className="kicker">YOUR AGENCY WORKSPACE</p>
      <div className="dashboard-section-heading dashboard-section-heading-action">
        <div><h1>My <em>properties.</em></h1><p className="muted">Only properties managed by your agency appear here.</p></div>
        <div className="property-page-actions"><Link className="btn workspace-secondary" href="/dashboard/import?kind=properties">Import from Excel</Link><Link className="btn" href="/dashboard/properties/new">+ Add property</Link></div>
      </div>
      <PropertyTable properties={properties} />
    </main>
  </>;
}
