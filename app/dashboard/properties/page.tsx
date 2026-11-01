import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProperty, propertyStatus } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Money, PlatformHeader } from "@/components/platform";
import { requireUser } from "@/lib/auth";
import type { Property } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

type AgencyProperty = Property & { lead_count: number };

export const dynamic = "force-dynamic";

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

  return (
    <>
      <PlatformHeader />
      <main className="workspace dashboard">
        <p className="kicker">YOUR AGENCY WORKSPACE</p>
        <div className="dashboard-section-heading dashboard-section-heading-action">
          <div>
            <h1>My <em>properties.</em></h1>
            <p className="muted">Only properties managed by your agency appear here.</p>
          </div>
          <Link className="btn" href="/dashboard/properties/new">+ Add property</Link>
        </div>
        <div className="table-wrap panel">
          <table>
            <thead>
              <tr><th>Property</th><th>Price</th><th>Status</th><th>Manage</th></tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id}>
                  <td><strong>{property.title}</strong><small>{property.locality}, {property.city} · {property.intent}</small></td>
                  <td><Money value={property.price} /></td>
                  <td><span className={`badge ${property.status}`}>{property.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/dashboard/properties/${property.id}`}>Edit</Link>
                      <form action={deleteProperty}>
                        <input type="hidden" name="id" value={property.id} />
                        <ConfirmDeleteButton
                          disabled={property.lead_count > 0}
                          title={property.lead_count > 0
                            ? "Resolve or remove linked customer enquiries before deleting this property."
                            : "Permanently delete this property"}
                          confirmMessage={`Permanently delete "${property.title}"? This cannot be undone.`}
                        >
                          Delete property
                        </ConfirmDeleteButton>
                      </form>
                      <form action={propertyStatus}>
                        <input type="hidden" name="id" value={property.id} />
                        <select name="status" aria-label={`Status for ${property.title}`} defaultValue="">
                          <option value="" disabled>Change status</option>
                          {["published", "sold", "rented", "withdrawn"].map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <button className="btn small">Save</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!properties.length && (
            <p className="empty">Your agency has no listings yet. Add a property to get started.</p>
          )}
        </div>
      </main>
    </>
  );
}
