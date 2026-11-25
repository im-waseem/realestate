import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyEditorForm } from "@/components/dashboard/property-editor-form";
import { PlatformHeader } from "@/components/platform";
import { requireUser } from "@/lib/auth";
import type { Agency, Property } from "@/lib/db";
import { hasAgencyFeature } from "@/lib/features";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit property", robots: { index: false, follow: false } };

export default async function Editor({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agency_id?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const isAdmin = user.role === "super_admin";
  const supabase = await createSupabaseServerClient();
  let property: Property | undefined;
  if (id !== "new") {
    const result = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    property = supabaseData(result.data, result.error, "Unable to load property") ?? undefined;
  }
  if (id !== "new" && (!property || (!isAdmin && property.agency_id !== user.agency_id))) notFound();

  let agencies: Pick<Agency, "id" | "name" | "status">[] = [];
  if (isAdmin) {
    const result = await supabase.from("agencies").select("id,name,status").order("name");
    agencies = supabaseData(result.data, result.error, "Unable to load agencies");
  }
  const agencyId = property?.agency_id || (isAdmin ? query.agency_id : user.agency_id) || "";

  return <>
    <PlatformHeader />
    <main className={`workspace editor ${isAdmin ? "platform-workspace" : "agency-workspace"}`}>
      <p className="kicker">PROPERTY MANAGEMENT</p>
      <h1>{property ? "Edit" : "Add a"} <em>property.</em></h1>
      <p className="muted">{isAdmin ? "Manage listings for any agency." : "Manage properties in your agency workspace."}</p>
      <p className="property-import-prompt">Working from a spreadsheet? <Link href="/dashboard/import?kind=properties">Import listings from Excel</Link>.</p>
      {property && hasAgencyFeature(user, "home_loans") && (
        <p><Link className="btn small workspace-secondary" href={`/dashboard/home-loans/new?property_id=${encodeURIComponent(property.id)}`}>Request home loan for a customer</Link></p>
      )}
      <PropertyEditorForm property={property} agencies={agencies} isAdmin={isAdmin} agencyId={agencyId} returnPath={isAdmin ? "/dashboard#inventory" : "/dashboard/properties"} />
    </main>
  </>;
}
