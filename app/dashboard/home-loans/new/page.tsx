import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NewHomeLoanForm } from "@/components/dashboard/home-loans";
import { PlatformHeader } from "@/components/platform";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

export const metadata: Metadata = { title: "Request a home loan", robots: { index: false, follow: false } };

export default async function NewHomeLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ agency_id?: string; property_id?: string; source_lead_id?: string }>;
}) {
  const user = await requireAgencyFeature("home_loans");
  const query = await searchParams;
  const isAdmin = user.role === "super_admin";
  const supabase = await createSupabaseServerClient();

  let sourceLead: {
    id: string;
    agency_id: string;
    property_id: string | null;
    name: string;
    phone: string;
    email: string;
  } | undefined;
  if (query.source_lead_id) {
    const result = await supabase
      .from("leads")
      .select("id,agency_id,property_id,name,phone,email")
      .eq("id", query.source_lead_id)
      .maybeSingle();
    sourceLead = supabaseData(result.data, result.error, "Unable to load the source enquiry") ?? undefined;
    if (!sourceLead) notFound();
  }

  const [propertiesResult, profilesResult, agenciesResult] = await Promise.all([
    supabase.from("properties").select("id,title,city,agency_id").order("title"),
    supabase.from("profiles").select("id,name,agency_id").eq("is_active", true).in("role", ["agency_admin", "agent"]),
    isAdmin ? supabase.from("agencies").select("id,name").order("name") : Promise.resolve({ data: [], error: null }),
  ]);
  const properties = supabaseData(propertiesResult.data, propertiesResult.error, "Unable to load properties");
  const profiles = supabaseData(profilesResult.data, profilesResult.error, "Unable to load agency assignees");
  const agencies = supabaseData(agenciesResult.data, agenciesResult.error, "Unable to load agencies");

  const requestedPropertyId = query.property_id || sourceLead?.property_id || "";
  const property = requestedPropertyId ? properties.find((item) => item.id === requestedPropertyId) : undefined;
  if (requestedPropertyId && !property) notFound();
  if (sourceLead && property && sourceLead.agency_id !== property.agency_id) notFound();

  const initialAgencyId = sourceLead?.agency_id || property?.agency_id || query.agency_id || user.agency_id || "";
  if (!isAdmin && initialAgencyId !== user.agency_id) notFound();
  if (isAdmin && initialAgencyId && !agencies.some((agency) => agency.id === initialAgencyId)) notFound();

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <p className="kicker">CUSTOMER FINANCING</p>
        <h1>Start a home-loan <em>request.</em></h1>
        <p className="muted">Add the customer and financing details. Link a property or enquiry when helpful.</p>
        <NewHomeLoanForm
          agencies={agencies}
          properties={properties}
          assignees={profiles.map((profile) => ({ id: profile.id, name: profile.name, agency_id: profile.agency_id }))}
          isAdmin={isAdmin}
          initialAgencyId={initialAgencyId}
          initialPropertyId={property?.id || ""}
          sourceLead={sourceLead}
        />
      </main>
    </>
  );
}
