import type { Metadata } from "next";
import Link from "next/link";
import { submitAgencyQrEnquiry } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("realty_public_agency", { target_agency_id: id });
  return { title: data?.[0] ? `${data[0].name} | Agency enquiries` : "Agency enquiry" };
}

export default async function AgencyQrPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; message?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("realty_public_agency", { target_agency_id: id });
  const agency = !error ? data?.[0] : undefined;

  return (
    <main className="agency-qr-page">
      <header className="agency-qr-header"><Link href="/" className="agency-qr-brand">Waseem Realty</Link><span>Agency enquiry</span></header>
      {agency ? (
        <div className="agency-qr-content">
          <section className="agency-qr-intro">
            <p className="kicker">YOU FOUND YOUR LOCAL AGENCY</p>
            <h1>Let’s find the right <em>place.</em></h1>
            <p>Send your requirements to {agency.name}. Their team can follow up with you directly.</p>
          </section>
          <section className="panel agency-qr-details">
            <p className="kicker">AGENCY DETAILS</p>
            <h2>{agency.name}</h2>
            {agency.phone && <p><strong>Phone</strong><a href={`tel:${agency.phone}`}>{agency.phone}</a></p>}
            {agency.address && <p><strong>Office</strong><span>{agency.address}</span></p>}
            {agency.lat !== null && agency.lng !== null && <a className="agency-qr-map" href={`https://www.openstreetmap.org/?mlat=${agency.lat}&mlon=${agency.lng}#map=15/${agency.lat}/${agency.lng}`} target="_blank" rel="noreferrer">View office location</a>}
          </section>
          <section className="panel agency-qr-form-card" id="enquiry">
            <p className="kicker">CUSTOMER ENQUIRY</p>
            <h2>Tell us what you need</h2>
            {query.sent === "1" ? <p className="agency-qr-success" role="status">Your enquiry was sent to {agency.name}. The agency can now follow up with you.</p> : (
              <>
                {query.message && <p className="agency-qr-error" role="alert">{query.message}</p>}
                <form action={submitAgencyQrEnquiry} className="agency-qr-form">
                  <input type="hidden" name="agency_id" value={agency.id} />
                  <label>Your name<input name="name" autoComplete="name" maxLength={100} required /></label>
                  <label>Mobile number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={25} required /></label>
                  <label>Email (optional)<input name="email" type="email" autoComplete="email" maxLength={254} /></label>
                  <label>Looking to<select name="intent" defaultValue="buy"><option value="buy">Buy</option><option value="sell">Sell</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
                  <label className="agency-qr-requirements">Your requirements<textarea name="requirements" minLength={10} maxLength={2000} rows={4} placeholder="Property type, preferred area, budget, or any other details" required /></label>
                  <button className="btn" type="submit">Send enquiry</button>
                  <small>Your details are shared with this agency so they can respond to you.</small>
                </form>
              </>
            )}
          </section>
        </div>
      ) : (
        <section className="agency-qr-unavailable"><p className="kicker">QR LINK UNAVAILABLE</p><h1>This agency page isn’t available.</h1><p>Ask the agency for an up-to-date QR code or return to the property catalogue.</p><Link href="/properties">Browse properties</Link></section>
      )}
      <footer className="agency-qr-footer">Powered by Waseem Realty</footer>
    </main>
  );
}
