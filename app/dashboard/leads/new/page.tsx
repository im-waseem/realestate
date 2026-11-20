import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createLead } from "@/app/actions";
import { PlatformHeader, Notice } from "@/components/platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

const sources = [
  ["walk_in", "Walk-in"],
  ["phone", "Phone call"],
  ["website", "Website"],
  ["referral", "Referral"],
  ["other", "Other"],
];

export default async function NewLead({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  let agencies: { id: string; name: string }[] = [];
  if (user.role === "super_admin") {
    const result = await supabase.from("agencies").select("id,name").order("name");
    agencies = supabaseData(result.data, result.error, "Unable to load agencies");
  }
  if (user.role !== "super_admin" && !user.agency_id) notFound();

  return (
    <>
      <PlatformHeader />
      <main className="workspace editor">
        <p className="kicker">CUSTOMER REQUIREMENTS</p>
        <h1>Every enquiry.<br /><em>A new possibility.</em></h1>
        <p className="muted">Record a client’s needs whether they visit the office, call, or find you online.</p>
        <Notice message={query.message} />
        <form action={createLead} className="panel stack">
          {user.role === "super_admin" && (
            <label>Agency<select name="agency_id" required defaultValue="">
              <option value="" disabled>Select agency</option>
              {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
            </select></label>
          )}
          <div className="form-grid">
            <label>Customer name<input name="name" required maxLength={100} /></label>
            <label>Mobile number<input name="phone" type="tel" required maxLength={25} /></label>
            <label>Email (optional)<input name="email" type="email" maxLength={254} /></label>
            <label>Client area or address (optional)<input name="client_address" maxLength={500} placeholder="Locality or address" /></label>
            <label>Enquiry source<select name="source" defaultValue="walk_in">{sources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Looking to<select name="intent">{["buy", "sell", "rent", "lease"].map((intent) => <option key={intent}>{intent}</option>)}</select></label>
          </div>
          <label>Requirements<textarea name="requirements" required maxLength={2000} placeholder="Property type, preferred locality, budget, move-in date, and any other requirements." /></label>
          <button className="btn">Save customer requirement →</button>
        </form>
      </main>
    </>
  );
}
