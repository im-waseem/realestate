import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformHeader } from "@/components/platform";
import { WorkbookImport } from "@/components/dashboard/workbook-import";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

export default async function ImportRecords({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const superAdmin = user.role === "super_admin";
  if (!superAdmin && !user.agency_id) notFound();

  const supabase = await createSupabaseServerClient();
  let agencies: { id: string; name: string; status: string }[] = [];
  if (superAdmin) {
    const result = await supabase.from("agencies").select("id,name,status").order("name");
    agencies = supabaseData(result.data, result.error, "Unable to load agencies");
  }

  return (
    <>
      <PlatformHeader />
      <main className={`workspace editor data-import-page ${superAdmin ? "platform-workspace" : "agency-workspace"}`}>
        <p className="kicker">AGENCY DATA</p>
        <h1>Import your <em>records.</em></h1>
        <p className="muted">Import existing property listings and customer enquiries from an Excel workbook or CSV file.</p>
        <p className="import-back-link"><Link href={query.kind === "leads" ? "/dashboard#leads" : "/dashboard/properties"}>← Back to {query.kind === "leads" ? "enquiries" : "properties"}</Link></p>
        <WorkbookImport agencies={agencies} superAdmin={superAdmin} initialKind={query.kind === "leads" ? "leads" : "properties"} />
      </main>
    </>
  );
}
