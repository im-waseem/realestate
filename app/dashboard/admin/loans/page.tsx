import Link from "next/link";
import { notFound } from "next/navigation";
import { logout, updateAgencyLoanFields, updateAgencyLoanProduct } from "@/app/actions";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { loanStatusLabel } from "@/lib/loan-status";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";

const loanStatuses = ["draft", "info_requested", "submitted_to_admin", "under_review", "sanctioned", "disbursed", "rejected", "cancelled"] as const;

export default async function AdminLoansPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();

  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1);
  const db = await createSupabaseServerClient();
  const [summaryResult, leadsResult, agenciesResult, typesResult, lendersResult, fieldSettingsResult, loanProductsResult] = await Promise.all([
    db.from("loan_summary_by_agency_v").select("agency_id,agency_name,total_leads,submitted_to_admin,under_review,info_requested,sanctioned,disbursed,rejected").order("agency_name"),
    (() => {
      let query = db.from("loan_leads_admin_v")
        .select("id,agency_id,agency_name,loan_type_name,lender_name,customer_name,first_name,middle_name,mother_name,father_name,date_of_birth,pincode,applicant_address,phone,email,loan_amount,status,forwarded_at", { count: "exact" })
        .order("created_at", { ascending: false });
      if (q.agency) query = query.eq("agency_id", q.agency);
      if (loanStatuses.includes(q.status as typeof loanStatuses[number])) query = query.eq("status", q.status as typeof loanStatuses[number]);
      if (q.type) query = query.eq("loan_type", q.type);
      if (q.lender) query = query.eq("assigned_lender_id", q.lender);
      if (q.from) query = query.gte("forwarded_at", q.from);
      if (q.to) query = query.lte("forwarded_at", `${q.to}T23:59:59`);
      if (q.min) query = query.gte("loan_amount", Number(q.min));
      if (q.max) query = query.lte("loan_amount", Number(q.max));
      if (q.q) {
        const needle = q.q.replace(/[,%()]/g, " ");
        query = query.or(`customer_name.ilike.%${needle}%,phone.ilike.%${needle}%`);
      }
      return query.range((page - 1) * 25, page * 25 - 1);
    })(),
    db.from("agencies").select("id,name").order("name"),
    db.from("loan_types").select("code,name").order("sort_order"),
    db.from("lenders").select("id,name").order("name"),
    db.from("agency_loan_field_settings").select("agency_id,enabled_fields"),
    db.from("agency_loan_products").select("agency_id,loan_type,enabled"),
  ]);

  const summary = supabaseData(summaryResult.data, summaryResult.error, "Unable to load loan summary");
  const leads = supabaseData(leadsResult.data, leadsResult.error, "Unable to load loan applications");
  const agencies = supabaseData(agenciesResult.data, agenciesResult.error, "Unable to load agencies");
  const types = supabaseData(typesResult.data, typesResult.error, "Unable to load loan types");
  const lenders = supabaseData(lendersResult.data, lendersResult.error, "Unable to load lenders");
  const fieldSettings = supabaseData(fieldSettingsResult.data, fieldSettingsResult.error, "Unable to load loan field settings");
  const loanProducts = supabaseData(loanProductsResult.data, loanProductsResult.error, "Unable to load agency loan products");
  const total = leadsResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return <WorkspaceShell theme="platform" defaultView="loans" allowedViews={[]}>
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" href="/dashboard"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></Link>
      <div className="dashboard-sidebar-account"><span className="dashboard-sidebar-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-sidebar-account-copy"><strong>{user.name}</strong><small>Super admin</small></span></div>
      <p className="dashboard-sidebar-label">WORKSPACE</p>
      <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav">
        <Link href="/dashboard"><span aria-hidden="true">▦</span><span>Overview</span></Link>
        <Link href="/dashboard#agencies"><span aria-hidden="true">▣</span><span>Agencies</span></Link>
        <Link href="/dashboard/admin/agencies"><span aria-hidden="true">✓</span><span>Agency approvals</span></Link>
        <Link href="/dashboard#inventory"><span aria-hidden="true">⌂</span><span>Properties</span></Link>
        <Link href="/dashboard/admin/loans" aria-current="page"><span aria-hidden="true">◤</span><span>Loan applications</span></Link>
        <Link href="/dashboard/admin/loan-settings"><span aria-hidden="true">⚙</span><span>Loan settings</span></Link>
        <Link href="/dashboard#team"><span aria-hidden="true">♧</span><span>Team</span></Link>
      </nav>
      <div className="dashboard-sidebar-bottom"><Link className="dashboard-sidebar-public" href="/">View public website</Link><form action={logout}><button className="dashboard-sidebar-signout" type="submit">Sign out</button></form></div>
    </aside>
    <div className="dashboard-main">
      <main className="workspace dashboard platform-dashboard-page">
        <header className="workspace-topbar"><div><span className="workspace-status-dot" /> Platform control center</div><details className="dashboard-user-menu"><summary><span className="dashboard-user-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-user-copy"><strong>{user.name}</strong><small>Administrator</small></span><span className="dashboard-user-chevron" aria-hidden="true">⌄</span></summary><div className="dashboard-user-menu-panel"><strong>{user.name}</strong><small>{user.email}</small><form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form></div></details></header>
        <p className="kicker">PLATFORM ADMINISTRATION</p>
        <h1>Loan <em>applications.</em></h1>

        <form method="get" className="panel dashboard-section form-grid">
          <label>Agency<select name="agency" defaultValue={q.agency || ""}><option value="">All agencies</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={q.status || ""}><option value="">All statuses</option>{loanStatuses.map((status) => <option key={status} value={status}>{loanStatusLabel(status)}</option>)}</select></label>
          <label>Type<select name="type" defaultValue={q.type || ""}><option value="">All types</option>{types.map((type) => <option key={type.code} value={type.code}>{type.name}</option>)}</select></label>
          <label>Lender<select name="lender" defaultValue={q.lender || ""}><option value="">All lenders</option>{lenders.map((lender) => <option key={lender.id} value={lender.id}>{lender.name}</option>)}</select></label>
          <label>From<input type="date" name="from" defaultValue={q.from} /></label>
          <label>To<input type="date" name="to" defaultValue={q.to} /></label>
          <label>Min amount<input type="number" name="min" defaultValue={q.min} /></label>
          <label>Max amount<input type="number" name="max" defaultValue={q.max} /></label>
          <label>Search<input name="q" defaultValue={q.q} placeholder="Applicant or phone" /></label>
          <button className="btn small">Apply filters</button>
          <a className="btn small" href={`/dashboard/admin/loans/export?${new URLSearchParams(Object.entries(q).filter((entry): entry is [string, string] => !!entry[1]))}`}>Export CSV</a>
        </form>

        <section className="panel dashboard-section table-wrap">
          <h2>Applications <small>{total} total</small></h2>
          <table><thead><tr><th>Agency</th><th>Type</th><th>Lender</th><th>Applicant</th><th>Amount</th><th>Status</th><th>Forwarded</th></tr></thead>
            <tbody>{leads.map((lead) => <tr key={lead.id} className={lead.status === "submitted_to_admin" ? "new-loan-lead" : ""}>
              <td>{lead.agency_name}</td><td>{lead.loan_type_name}</td><td>{lead.lender_name || "—"}</td>
              <td><Link href={`/dashboard/admin/loans/${lead.id}`}>{[lead.first_name, lead.middle_name].filter(Boolean).join(" ") || lead.customer_name}</Link><br />{lead.phone} · {lead.email || "No email"}{lead.pincode ? ` · ${lead.pincode}` : ""}</td>
              <td>₹{Number(lead.loan_amount).toLocaleString("en-IN")}</td><td><strong>{loanStatusLabel(lead.status)}</strong></td>
              <td>{lead.forwarded_at ? new Date(lead.forwarded_at).toLocaleDateString("en-IN") : "—"}</td>
            </tr>)}</tbody>
          </table>
          {!leads.length && <p>No loan applications match these filters.</p>}
          <nav className="form-grid" aria-label="Application pages">
            <Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={`?${new URLSearchParams({ ...q, page: String(Math.max(page - 1, 1)) } as Record<string, string>)}`}>Previous</Link>
            <span>Page {page} of {totalPages}</span>
            <Link aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} href={`?${new URLSearchParams({ ...q, page: String(Math.min(page + 1, totalPages)) } as Record<string, string>)}`}>Next</Link>
          </nav>
        </section>

        <div className="form-grid">{summary.map((agency) => <article className="panel dashboard-section" key={agency.agency_id}>
          <strong>{agency.agency_name}</strong><p>Pending: <b>{agency.submitted_to_admin}</b></p>
          <p>Total {agency.total_leads} · in process {agency.under_review} · approved {agency.sanctioned} · disbursed {agency.disbursed}</p>
        </article>)}</div>

        <details className="panel dashboard-section">
          <summary><strong>Agency loan controls</strong></summary>
          <p className="muted">Enable loan types and choose which optional applicant details each agency may collect. Phone, email, loan type, and requested amount stay required. No documents are collected.</p>
          <div className="stack">{agencies.map((agency) => {
            const setting = fieldSettings.find((row) => row.agency_id === agency.id);
            const enabled = new Set<string>(setting?.enabled_fields || ["first_name", "middle_name", "mother_name", "father_name", "date_of_birth", "pincode", "applicant_address"]);
            return <article className="panel dashboard-section" key={agency.id}>
              <h3>{agency.name}</h3><h4>Loan types</h4>
              <div className="form-grid">{types.map((type) => {
                const active = loanProducts.some((row) => row.agency_id === agency.id && row.loan_type === type.code && row.enabled);
                return <form action={updateAgencyLoanProduct} className="agency-feature-control" key={type.code}>
                  <input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="loan_type" value={type.code} />
                  <input type="hidden" name="enabled" value={active ? "false" : "true"} /><input type="hidden" name="return_to" value="/dashboard/admin/loans" />
                  <strong>{type.name}</strong><span className={`badge ${active ? "active" : "suspended"}`}>{active ? "Enabled" : "Disabled"}</span>
                  <button className="btn small workspace-secondary">{active ? "Disable" : "Enable"}</button>
                </form>;
              })}</div>
              <h4>Optional applicant details</h4>
              <form action={updateAgencyLoanFields} className="form-grid"><input type="hidden" name="agency_id" value={agency.id} />
                {[["first_name", "First name"], ["middle_name", "Middle name"], ["mother_name", "Mother's name"], ["father_name", "Father's name"], ["date_of_birth", "Date of birth"], ["pincode", "PIN code lookup"], ["applicant_address", "Address"]].map(([key, label]) => <label key={key}><input type="checkbox" name={key} defaultChecked={enabled.has(key)} />{label}</label>)}
                <button className="btn small">Save data settings</button>
              </form>
            </article>;
          })}</div>
        </details>
      </main>
    </div>
  </WorkspaceShell>;
}
