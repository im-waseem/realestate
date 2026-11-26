import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NewHomeLoanForm } from "@/components/dashboard/home-loans";
import { PlatformHeader } from "@/components/platform";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import type { LoanProductType } from "@/lib/loan-products";

export const metadata: Metadata = { title: "Create a loan request", robots: { index: false, follow: false } };

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

  const [propertiesResult, profilesResult, agenciesResult, loanProductsResult, loanTypesResult, lendersResult] = await Promise.all([
    (() => {
      const propertiesQuery = supabase.from("properties").select("id,title,city,agency_id").order("title");
      return isAdmin ? propertiesQuery : propertiesQuery.eq("agency_id", user.agency_id || "");
    })(),
    supabase.from("profiles").select("id,name,agency_id").eq("is_active", true).in("role", ["agency_admin", "agent"]),
    isAdmin ? supabase.from("agencies").select("id,name").order("name") : Promise.resolve({ data: [], error: null }),
    supabase.from("agency_loan_products").select("agency_id,loan_type,enabled").eq("enabled", true),
    supabase.from("loan_types").select("code,name,is_active").eq("is_active", true).order("sort_order"),
    supabase.from("lenders").select("name,lender_type").eq("is_active", true).order("name"),
  ]);
  const properties = supabaseData(propertiesResult.data, propertiesResult.error, "Unable to load properties");
  const profiles = supabaseData(profilesResult.data, profilesResult.error, "Unable to load agency assignees");
  const agencies = supabaseData(agenciesResult.data, agenciesResult.error, "Unable to load agencies");
  const loanProducts = supabaseData(loanProductsResult.data, loanProductsResult.error, "Unable to load enabled loan products. Apply sql/migrations/20261130_agency_loan_products.sql") as { agency_id: string; loan_type: LoanProductType; enabled: boolean }[];
  const loanTypes = supabaseData(loanTypesResult.data, loanTypesResult.error, "Unable to load loan types. Apply sql/migrations/20261202_loan_masters.sql") as { code: string; name: string; is_active: boolean }[];
  const lenders = supabaseData(lendersResult.data, lendersResult.error, "Unable to load lenders. Apply sql/migrations/20261202_loan_masters.sql") as { name: string; lender_type: string }[];
  const loanTypeName = new Map(loanTypes.map((item) => [item.code, item.name]));
  const enabledProductsByAgency = Object.fromEntries((isAdmin ? agencies : [{ id: user.agency_id || "" }]).map((agency) => [agency.id, loanProducts.filter((row) => row.agency_id === agency.id && loanTypeName.has(row.loan_type)).map((row) => ({ id: row.loan_type, label: loanTypeName.get(row.loan_type) || row.loan_type }))])) as Record<string, { id: LoanProductType; label: string }[]>;

  const requestedPropertyId = query.property_id || sourceLead?.property_id || "";
  const property = requestedPropertyId ? properties.find((item) => item.id === requestedPropertyId) : undefined;
  if (requestedPropertyId && !property) notFound();
  if (sourceLead && property && sourceLead.agency_id !== property.agency_id) notFound();

  const initialAgencyId = sourceLead?.agency_id || property?.agency_id || query.agency_id || user.agency_id || "";
  if (!isAdmin && initialAgencyId !== user.agency_id) notFound();
  if (isAdmin && initialAgencyId && !agencies.some((agency) => agency.id === initialAgencyId)) notFound();
  if (!enabledProductsByAgency[initialAgencyId]?.length && initialAgencyId) notFound();

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <p className="kicker">CUSTOMER FINANCING</p>
        <h1>Start a loan <em>request.</em></h1>
        <p className="muted">Add the customer and financing details. Link a property or enquiry when helpful.</p>
        <NewHomeLoanForm
          agencies={agencies}
          properties={properties}
          assignees={profiles.map((profile) => ({ id: profile.id, name: profile.name, agency_id: profile.agency_id }))}
          isAdmin={isAdmin}
          initialAgencyId={initialAgencyId}
          initialPropertyId={property?.id || ""}
          sourceLead={sourceLead}
          enabledProductsByAgency={enabledProductsByAgency}
          lenders={lenders}
        />
      </main>
    </>
  );
}
