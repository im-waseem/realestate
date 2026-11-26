import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { decideAgencyApproval, logout, updateAgencyFeature, verifyAgencyRera } from "@/app/actions";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseData } from "@/lib/supabase/results";

export const metadata: Metadata = { title: "Agency approvals", robots: { index: false, follow: false } };

const statuses = ["pending", "approved", "rejected", "suspended"] as const;
type ApprovalStatus = (typeof statuses)[number];

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ status?: string; message?: string }> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();
  const query = await searchParams;
  const activeStatus = statuses.includes(query.status as ApprovalStatus) ? query.status as ApprovalStatus : "pending";
  const admin = createSupabaseAdminClient();
  const result = await admin.from("agencies")
    .select("id,name,status,contact_name,contact_email,phone,rera_agent_number,rera_state,rera_certificate_path,rera_verified,features,rejection_reason,created_at")
    .eq("status", activeStatus)
    .order("created_at", { ascending: false });
  const agencies = supabaseData(result.data, result.error, "Unable to load agency applications.");
  const certificateLinks = await Promise.all(agencies.map(async (agency) => {
    if (!agency.rera_certificate_path) return [agency.id, ""] as const;
    const { data } = await admin.storage.from("agency-rera-documents").createSignedUrl(agency.rera_certificate_path, 300);
    return [agency.id, data?.signedUrl || ""] as const;
  }));
  const certificateByAgency = new Map(certificateLinks);

  return (
    <WorkspaceShell theme="platform" defaultView="agencies" allowedViews={[]}>
      <aside className="dashboard-sidebar">
        <Link className="dashboard-sidebar-brand" href="/dashboard"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></Link>
        <div className="dashboard-sidebar-account"><span className="dashboard-sidebar-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-sidebar-account-copy"><strong>{user.name}</strong><small>Super admin</small></span></div>
        <p className="dashboard-sidebar-label">WORKSPACE</p>
        <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav">
          <Link href="/dashboard"><span aria-hidden="true">▦</span><span>Overview</span></Link>
          <Link href="/dashboard#agencies"><span aria-hidden="true">▣</span><span>Agencies</span></Link>
          <Link href="/dashboard/admin/agencies" aria-current="page"><span aria-hidden="true">✓</span><span>Agency approvals</span></Link>
          <Link href="/dashboard#inventory"><span aria-hidden="true">⌂</span><span>Properties</span></Link>
          <Link href="/dashboard#loans"><span aria-hidden="true">▤</span><span>Loans</span></Link>
          <Link href="/dashboard#team"><span aria-hidden="true">♧</span><span>Team</span></Link>
        </nav>
        <div className="dashboard-sidebar-bottom"><Link className="dashboard-sidebar-public" href="/">View public website</Link><form action={logout}><button className="dashboard-sidebar-signout" type="submit">Sign out</button></form></div>
      </aside>
      <div className="dashboard-main">
      <main className="workspace dashboard platform-dashboard-page">
        <header className="workspace-topbar"><div><span className="workspace-status-dot" /> Platform control center</div><details className="dashboard-user-menu"><summary aria-label={`Account menu for ${user.name}`}><span className="dashboard-user-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-user-copy"><strong>{user.name}</strong><small>Administrator</small></span><span className="dashboard-user-chevron" aria-hidden="true">⌄</span></summary><div className="dashboard-user-menu-panel"><strong>{user.name}</strong><small>{user.email}</small><form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form></div></details></header>
        <div className="workspace-title">
          <div><p className="kicker">PLATFORM ADMINISTRATION</p><h1>Agency <em>approvals.</em></h1><p className="muted">Review registrations, RERA documents, and workspace access.</p></div>
        </div>
        {query.message && <p className="notice" role="status">{query.message}</p>}
        <nav className="property-page-actions" aria-label="Filter agencies by status">
          {statuses.map((status) => <Link key={status} className={`btn small ${activeStatus === status ? "" : "workspace-secondary"}`} href={`/dashboard/admin/agencies?status=${status}`}>{status[0].toUpperCase() + status.slice(1)}</Link>)}
        </nav>
        {!agencies.length && <section className="panel"><p className="muted">No {activeStatus} agencies.</p></section>}
        <div className="stack">
          {agencies.map((agency) => (
            <article className="panel" key={agency.id}>
              <div className="dashboard-section-heading">
                <div><p className="kicker">{agency.status.toUpperCase()} · REGISTERED {new Date(agency.created_at).toLocaleDateString("en-IN")}</p><h2>{agency.name}</h2></div>
                <span className={`badge ${agency.status}`}>{agency.status}</span>
              </div>
              <div className="form-grid">
                <p><strong>Contact</strong><br />{agency.contact_name || "—"}</p>
                <p><strong>Email</strong><br /><a href={`mailto:${agency.contact_email}`}>{agency.contact_email}</a></p>
                <p><strong>Phone</strong><br /><a href={`tel:${agency.phone}`}>{agency.phone}</a></p>
                <p><strong>RERA agent number</strong><br />{agency.rera_agent_number || "—"}</p>
                <p><strong>RERA state</strong><br />{agency.rera_state || "—"}</p>
                <p><strong>RERA verification</strong><br />{agency.rera_verified ? "Verified" : "Not verified"}</p>
              </div>
              {agency.rejection_reason && <p><strong>Rejection reason:</strong> {agency.rejection_reason}</p>}
              {certificateByAgency.get(agency.id)
                ? <p><a href={certificateByAgency.get(agency.id)} target="_blank" rel="noreferrer">View RERA certificate (link expires in 5 minutes)</a></p>
                : <p className="muted">No RERA certificate is available.</p>}

              <div className="property-page-actions">
                {!agency.rera_verified && agency.rera_certificate_path && <form action={verifyAgencyRera}>
                  <input type="hidden" name="agency_id" value={agency.id} />
                  <button className="btn small workspace-secondary">Mark RERA verified</button>
                </form>}
                {agency.status === "pending" && <>
                  <form action={decideAgencyApproval}><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="decision" value="approve" /><input type="hidden" name="reason" value="" /><button className="btn small">Approve agency</button></form>
                  <form action={decideAgencyApproval} className="stack"><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="decision" value="reject" /><label>Rejection reason<input name="reason" required maxLength={1000} /></label><button className="btn small workspace-secondary">Reject</button></form>
                </>}
                {agency.status === "approved" && <form action={decideAgencyApproval}><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="decision" value="suspend" /><input type="hidden" name="reason" value="" /><button className="btn small workspace-secondary">Suspend access</button></form>}
                {agency.status === "suspended" && <form action={decideAgencyApproval}><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="decision" value="reactivate" /><input type="hidden" name="reason" value="" /><button className="btn small">Reactivate agency</button></form>}
              </div>
              <div className="property-page-actions">
                {([ ["home_loans", "Home loans"], ["loans", "Loan applications"], ["tools", "Tools"] ] as const).map(([feature, label]) => <form action={updateAgencyFeature} key={feature}>
                  <input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="feature" value={feature} /><input type="hidden" name="enabled" value={agency.features[feature] ? "false" : "true"} /><input type="hidden" name="return_to" value="/dashboard/admin/agencies" />
                  <button className="btn small workspace-secondary">{agency.features[feature] ? `Disable ${label}` : `Enable ${label}`}</button>
                </form>)}
              </div>
            </article>
          ))}
        </div>
      </main>
      </div>
    </WorkspaceShell>
  );
}
