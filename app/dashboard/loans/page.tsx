import Link from "next/link";
import { logout } from "@/app/actions";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { loanStatusLabel } from "@/lib/loan-status";

const loanStatuses = ["draft", "info_requested", "submitted_to_admin", "under_review", "sanctioned", "disbursed", "rejected", "cancelled"] as const;

export default async function AgencyLoansPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; q?: string; page?: string }> }) {
  const user = await requireAgencyFeature("loans");
  if (user.role === "super_admin" || !user.agency_id) return <main className="workspace editor"><h1>Loan applications unavailable</h1><p className="muted">Open the admin loan review page.</p><Link href="/dashboard/admin/loans">Admin loan review</Link></main>;
  const query = await searchParams;
  const requestedPage = Math.max(1, Number(query.page) || 1);
  const supabase = await createSupabaseServerClient();
  let countQuery = supabase.from("loan_leads").select("id", { count: "exact", head: true }).eq("agency_id", user.agency_id!);
  if (loanStatuses.includes(query.status as typeof loanStatuses[number])) countQuery = countQuery.eq("status", query.status as typeof loanStatuses[number]);
  if (query.type) countQuery = countQuery.eq("loan_type", query.type);
  if (query.q?.trim()) { const needle = query.q.trim().replace(/[,%()]/g, " "); countQuery = countQuery.or(`customer_name.ilike.%${needle}%,phone.ilike.%${needle}%`); }
  const [typesResult, countResult] = await Promise.all([
    supabase.from("loan_types").select("code,name").eq("is_active", true).order("sort_order"),
    countQuery,
  ]);
  if (countResult.error) throw new Error(`Unable to count loan applications: ${countResult.error.message}`);
  const total = countResult.count || 0;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 20)));
  let leadsQuery = supabase.from("loan_leads").select("id,loan_type,customer_name,phone,loan_amount,status,created_at", { count: "exact" }).eq("agency_id", user.agency_id!).order("created_at", { ascending: false });
  if (loanStatuses.includes(query.status as typeof loanStatuses[number])) leadsQuery = leadsQuery.eq("status", query.status as typeof loanStatuses[number]);
  if (query.type) leadsQuery = leadsQuery.eq("loan_type", query.type);
  if (query.q?.trim()) { const needle = query.q.trim().replace(/[,%()]/g, " "); leadsQuery = leadsQuery.or(`customer_name.ilike.%${needle}%,phone.ilike.%${needle}%`); }
  const leadsResult = await leadsQuery.range((page - 1) * 20, page * 20 - 1);
  const types = supabaseData(typesResult.data, typesResult.error, "Unable to load loan types");
  const leads = supabaseData(leadsResult.data, leadsResult.error, "Unable to load loan applications");
  const typeNames = new Map(types.map((type) => [type.code, type.name]));
  return <WorkspaceShell theme="agency" defaultView="overview" allowedViews={[]}>
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" href="/dashboard"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></Link>
      <div className="dashboard-sidebar-account"><span className="dashboard-sidebar-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-sidebar-account-copy"><strong>{user.name}</strong><small>Agency workspace</small></span></div>
      <p className="dashboard-sidebar-label">WORKSPACE</p>
      <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav"><Link href="/dashboard">Overview</Link><Link href="/dashboard#inventory">Properties</Link><Link href="/dashboard#leads">Enquiries</Link><Link href="/dashboard/loans" aria-current="page">Loans</Link><Link href="/dashboard#team">Team</Link></nav>
      <div className="dashboard-sidebar-bottom"><Link className="dashboard-sidebar-public" href="/">View public website</Link><form action={logout}><button className="dashboard-sidebar-signout" type="submit">Sign out</button></form></div>
    </aside>
    <div className="dashboard-main"><header className="workspace-topbar"><div><span className="workspace-status-dot" /> Agency workspace</div><details className="dashboard-user-menu"><summary><span className="dashboard-user-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-user-copy"><strong>{user.name}</strong><small>{user.email}</small></span><span className="dashboard-user-chevron" aria-hidden="true">⌄</span></summary><div className="dashboard-user-menu-panel"><strong>{user.name}</strong><small>{user.email}</small><form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form></div></details></header>
  <main className="workspace editor"><p className="kicker">AGENCY WORKSPACE</p><h1>Loan <em>applications.</em></h1><p className="muted">Create requests and track admin decisions.</p><p><Link className="btn" href="/dashboard/loans/new">+ New loan request</Link></p>
    <form method="get" className="form-grid"><label>Status<select name="status" defaultValue={query.status || ""}><option value="">All statuses</option>{loanStatuses.map(x=><option key={x} value={x}>{loanStatusLabel(x)}</option>)}</select></label><label>Loan type<select name="type" defaultValue={query.type || ""}><option value="">All types</option>{types.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label><label>Search name or phone<input name="q" defaultValue={query.q || ""}/></label><button className="btn small">Filter</button></form>
    <section className="panel dashboard-section"><table><thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>{leads.map(lead=><tr key={lead.id}><td><Link href={`/dashboard/loans/${lead.id}`}>{lead.customer_name}</Link><br/><small>{lead.phone}</small></td><td>{typeNames.get(lead.loan_type)||lead.loan_type}</td><td>₹{Number(lead.loan_amount).toLocaleString("en-IN")}</td><td>{loanStatusLabel(lead.status)}</td><td>{new Date(lead.created_at).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table>{!leads.length&&<p>No loan applications match those filters.</p>}<nav className="form-grid"><Link href={`?${new URLSearchParams({...query,page:String(Math.max(1,page-1))})}`}>Previous</Link><span>Page {page} · {leadsResult.count || 0} requests</span><Link href={`?${new URLSearchParams({...query,page:String(page+1)})}`}>Next</Link></nav></section>
  </main></div>
  </WorkspaceShell>;
}
