import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { logout, saveCommissionRule, saveLender, saveLoanType } from "@/app/actions";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import type { CommissionRule, Lender, LoanType } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Loan settings", robots: { index: false, follow: false } };

type SettingsTab = "types" | "lenders" | "rules";
type AgencyOption = { id: string; name: string };

function RuleFields({ rule, loanTypes, lenders, agencies }: { rule?: CommissionRule; loanTypes: LoanType[]; lenders: Lender[]; agencies: AgencyOption[] }) {
  return <>
    {rule && <input type="hidden" name="id" value={rule.id} />}
    <label>Loan type<select name="loan_type_id" required defaultValue={rule?.loan_type_id || loanTypes[0]?.id}>{loanTypes.filter((item) => item.is_active || item.id === rule?.loan_type_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Lender (optional)<select name="lender_id" defaultValue={rule?.lender_id || ""}><option value="">Any lender</option>{lenders.filter((item) => item.is_active || item.id === rule?.lender_id).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.lender_type.toUpperCase()})</option>)}</select></label>
    <label>Agency override (optional)<select name="agency_id" defaultValue={rule?.agency_id || ""}><option value="">All agencies</option>{agencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Basis<select name="basis" defaultValue={rule?.basis || "percent"}><option value="percent">Percent of loan amount</option><option value="flat">Flat amount</option></select></label>
    <label>Percent<input name="percent" type="number" min="0" max="100" step="0.0001" defaultValue={rule?.percent ?? ""} /></label>
    <label>Flat amount<input name="flat_amount" type="number" min="0" step="0.01" defaultValue={rule?.flat_amount ?? ""} /></label>
    <label>Minimum commission<input name="minimum_commission" type="number" min="0" step="0.01" defaultValue={rule?.minimum_commission ?? ""} /></label>
    <label>Maximum commission<input name="maximum_commission" type="number" min="0" step="0.01" defaultValue={rule?.maximum_commission ?? ""} /></label>
    <label>Agency share (%)<input name="agency_share_percent" type="number" min="0" max="100" step="0.0001" defaultValue={rule?.agency_share_percent ?? 0} required /></label>
    <label>Effective from<input name="effective_from" type="date" defaultValue={rule?.effective_from || new Date().toISOString().slice(0, 10)} required /></label>
    <label>Effective to<input name="effective_to" type="date" defaultValue={rule?.effective_to || ""} /></label>
    <label>Status<select name="is_active" defaultValue={rule?.is_active === false ? "false" : "true"}><option value="true">Active</option><option value="false">Disabled</option></select></label>
  </>;
}

function Sidebar({ children, userName, email }: { children: ReactNode; userName: string; email: string }) {
  const links: [string, string, string][] = [
    ["/dashboard", "▦", "Overview"],
    ["/dashboard#agencies", "▣", "Agencies"],
    ["/dashboard/admin/agencies", "✓", "Agency approvals"],
    ["/dashboard#inventory", "⌂", "Properties"],
    ["/dashboard#loans", "▤", "Loans"],
    ["/dashboard/admin/loan-settings", "⚙", "Loan settings"],
    ["/dashboard#team", "♧", "Team"],
  ];
  return <WorkspaceShell theme="platform" defaultView="loans" allowedViews={[]}>
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" href="/dashboard"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></Link>
      <div className="dashboard-sidebar-account"><span className="dashboard-sidebar-avatar">{userName.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-sidebar-account-copy"><strong>{userName}</strong><small>Super admin</small></span></div>
      <p className="dashboard-sidebar-label">WORKSPACE</p>
      <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav">{links.map(([href, icon, label]) => <Link key={href} href={href} aria-current={label === "Loan settings" ? "page" : undefined}><span aria-hidden="true">{icon}</span><span>{label}</span></Link>)}</nav>
      <div className="dashboard-sidebar-bottom"><Link className="dashboard-sidebar-public" href="/">View public website</Link><form action={logout}><button className="dashboard-sidebar-signout" type="submit">Sign out</button></form></div>
    </aside>
    <div className="dashboard-main"><main className="workspace dashboard platform-dashboard-page">
      <header className="workspace-topbar"><div><span className="workspace-status-dot" /> Platform control center</div><details className="dashboard-user-menu"><summary><span className="dashboard-user-avatar">{userName.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-user-copy"><strong>{userName}</strong><small>Administrator</small></span><span className="dashboard-user-chevron" aria-hidden="true">⌄</span></summary><div className="dashboard-user-menu-panel"><strong>{userName}</strong><small>{email}</small><form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form></div></details></header>
      {children}
    </main></div>
  </WorkspaceShell>;
}

export default async function LoanSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();
  const query = await searchParams;
  const tabs: SettingsTab[] = ["types", "lenders", "rules"];
  const tab = tabs.includes(query.tab as SettingsTab) ? query.tab as SettingsTab : "types";
  const supabase = await createSupabaseServerClient();
  const [typesResult, lendersResult, rulesResult, agenciesResult] = await Promise.all([
    supabase.from("loan_types").select("*").order("sort_order").order("name"),
    supabase.from("lenders").select("*").order("name"),
    supabase.from("commission_rules").select("*").order("created_at", { ascending: false }),
    supabase.from("agencies").select("id,name").order("name"),
  ]);
  const loanTypes = supabaseData(typesResult.data, typesResult.error, "Unable to load loan types") as LoanType[];
  const lenders = supabaseData(lendersResult.data, lendersResult.error, "Unable to load lenders") as Lender[];
  const rules = supabaseData(rulesResult.data, rulesResult.error, "Unable to load commission rules") as CommissionRule[];
  const agencies = supabaseData(agenciesResult.data, agenciesResult.error, "Unable to load agencies") as AgencyOption[];
  const typeById = new Map(loanTypes.map((item) => [item.id, item.name]));
  const lenderById = new Map(lenders.map((item) => [item.id, item.name]));
  const agencyById = new Map(agencies.map((item) => [item.id, item.name]));

  const selectedTypeId = loanTypes.some((item) => item.id === query.sample_type && item.is_active) ? query.sample_type! : loanTypes.find((item) => item.is_active)?.id || "";
  const selectedLenderId = lenders.some((item) => item.id === query.sample_lender && item.is_active) ? query.sample_lender! : "";
  const selectedAgencyId = agencies.some((item) => item.id === query.sample_agency) ? query.sample_agency! : "";
  const sampleAmount = Number(query.sample_amount);
  const validSampleAmount = Number.isFinite(sampleAmount) && sampleAmount > 0 ? sampleAmount : 1_000_000;
  const today = new Date().toISOString().slice(0, 10);
  const applicable = rules.filter((rule) => rule.is_active && rule.loan_type_id === selectedTypeId
    && (!rule.lender_id || rule.lender_id === selectedLenderId)
    && (!rule.lender_id || lenders.some((item) => item.id === rule.lender_id && item.is_active))
    && (!rule.agency_id || rule.agency_id === selectedAgencyId)
    && rule.effective_from <= today && (!rule.effective_to || rule.effective_to >= today));
  applicable.sort((a, b) => Number(!!b.agency_id) - Number(!!a.agency_id)
    || Number(!!b.lender_id) - Number(!!a.lender_id)
    || b.effective_from.localeCompare(a.effective_from));
  const matchedRule = applicable[0];
  const rawCommission = matchedRule ? matchedRule.basis === "percent"
    ? validSampleAmount * Number(matchedRule.percent) / 100
    : Number(matchedRule.flat_amount) : null;
  const commission = rawCommission === null ? null : Math.min(matchedRule?.maximum_commission == null ? Infinity : Number(matchedRule.maximum_commission), Math.max(matchedRule?.minimum_commission == null ? 0 : Number(matchedRule.minimum_commission), rawCommission));
  const agencyShare = commission === null ? null : commission * Number(matchedRule?.agency_share_percent || 0) / 100;
  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

  return <Sidebar userName={user.name} email={user.email}>
    <div className="workspace-title"><div><p className="kicker">PLATFORM ADMINISTRATION</p><h1>Loan <em>settings.</em></h1><p className="muted">Manage loan products, lenders, and the commission rules used for estimates.</p></div></div>
    {query.message && <p className="notice" role="status">{query.message}</p>}
    <nav className="property-page-actions" aria-label="Loan settings tabs">{tabs.map((item) => <Link key={item} className={`btn small ${tab === item ? "" : "workspace-secondary"}`} href={`/dashboard/admin/loan-settings?tab=${item}`}>{item === "types" ? "Loan types" : item === "lenders" ? "Lenders" : "Commission rules"}</Link>)}</nav>

    {tab === "types" && <>
      <section className="panel dashboard-section"><h2>Add loan type</h2><form action={saveLoanType} className="form-grid"><label>Code<input name="code" placeholder="vehicle_loan" pattern="[a-z][a-z0-9_]{1,49}" required /></label><label>Name<input name="name" maxLength={100} required /></label><label>Sort order<input name="sort_order" type="number" min="0" defaultValue="100" required /></label><input type="hidden" name="is_active" value="true" /><button className="btn">Add type</button></form></section>
      <div className="stack">{loanTypes.map((item) => <article className="panel dashboard-section" key={item.id}><form action={saveLoanType} className="form-grid"><input type="hidden" name="id" value={item.id} /><label>Code<input name="code" defaultValue={item.code} pattern="[a-z][a-z0-9_]{1,49}" required /></label><label>Name<input name="name" defaultValue={item.name} maxLength={100} required /></label><label>Sort order<input name="sort_order" type="number" min="0" defaultValue={item.sort_order} required /></label><label>Status<select name="is_active" defaultValue={item.is_active ? "true" : "false"}><option value="true">Active</option><option value="false">Disabled</option></select></label><button className="btn small workspace-secondary">Save</button></form></article>)}</div>
    </>}

    {tab === "lenders" && <>
      <section className="panel dashboard-section"><h2>Add lender</h2><form action={saveLender} className="form-grid"><label>Name<input name="name" maxLength={150} required /></label><label>Type<select name="lender_type"><option value="bank">Bank</option><option value="nbfc">NBFC</option><option value="hfc">HFC</option></select></label><input type="hidden" name="is_active" value="true" /><button className="btn">Add lender</button></form></section>
      <div className="stack">{lenders.map((item) => <article className="panel dashboard-section" key={item.id}><form action={saveLender} className="form-grid"><input type="hidden" name="id" value={item.id} /><label>Name<input name="name" defaultValue={item.name} maxLength={150} required /></label><label>Type<select name="lender_type" defaultValue={item.lender_type}><option value="bank">Bank</option><option value="nbfc">NBFC</option><option value="hfc">HFC</option></select></label><label>Status<select name="is_active" defaultValue={item.is_active ? "true" : "false"}><option value="true">Active</option><option value="false">Disabled</option></select></label><button className="btn small workspace-secondary">Save</button></form></article>)}</div>
    </>}

    {tab === "rules" && <>
      <section className="panel dashboard-section"><h2>Add commission rule</h2><p className="muted">Minimum and maximum cap the commission amount. More specific agency rules take priority over lender-only and general rules.</p><form action={saveCommissionRule} className="form-grid"><RuleFields loanTypes={loanTypes} lenders={lenders} agencies={agencies} /><button className="btn">Add rule</button></form></section>
      <section className="panel dashboard-section"><h2>Try a sample</h2><form method="get" className="form-grid"><input type="hidden" name="tab" value="rules" /><label>Loan type<select name="sample_type" defaultValue={selectedTypeId}>{loanTypes.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Lender<select name="sample_lender" defaultValue={selectedLenderId}><option value="">No lender selected</option>{lenders.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Agency<select name="sample_agency" defaultValue={selectedAgencyId}><option value="">No agency selected</option>{agencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Loan amount (₹)<input name="sample_amount" type="number" min="1" step="0.01" defaultValue={validSampleAmount} required /></label><button className="btn">Find applicable rule</button></form><div className="panel dashboard-section" aria-live="polite">{matchedRule ? <><p><strong>Rule:</strong> {typeById.get(matchedRule.loan_type_id)} · {matchedRule.lender_id ? lenderById.get(matchedRule.lender_id) : "Any lender"} · {matchedRule.agency_id ? agencyById.get(matchedRule.agency_id) : "All agencies"}</p><p><strong>Commission:</strong> {money(commission || 0)} · <strong>Agency share:</strong> {money(agencyShare || 0)} ({matchedRule.agency_share_percent}%)</p><p className="muted">{matchedRule.basis === "percent" ? `${matchedRule.percent}% of ${money(validSampleAmount)}` : `Flat ${money(Number(matchedRule.flat_amount))}`} · effective {matchedRule.effective_from}{matchedRule.effective_to ? ` to ${matchedRule.effective_to}` : " onward"}</p></> : <p className="muted">No active rule matches this sample today.</p>}</div></section>
      <div className="stack">{rules.map((rule) => <article className="panel dashboard-section" key={rule.id}><p><strong>{typeById.get(rule.loan_type_id) || "Loan type"}</strong> · {rule.lender_id ? lenderById.get(rule.lender_id) : "Any lender"} · {rule.agency_id ? agencyById.get(rule.agency_id) : "All agencies"} · {rule.is_active ? "Active" : "Disabled"}</p><p className="muted">{rule.basis === "percent" ? `${rule.percent}%` : money(Number(rule.flat_amount))} · share {rule.agency_share_percent}% · {rule.effective_from}{rule.effective_to ? ` — ${rule.effective_to}` : " onward"}</p><details><summary>Edit rule</summary><form action={saveCommissionRule} className="form-grid"><RuleFields rule={rule} loanTypes={loanTypes} lenders={lenders} agencies={agencies} /><button className="btn small workspace-secondary">Save rule</button></form></details></article>)}</div>
    </>}
  </Sidebar>;
}
