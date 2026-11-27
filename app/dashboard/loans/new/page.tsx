import Link from "next/link";
import { logout } from "@/app/actions";
import { LoanLeadActionForm } from "@/components/dashboard/loan-lead-action-form";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { notFound } from "next/navigation";
import { PincodeAddressFields } from "@/components/dashboard/pincode-address-fields";

export default async function NewLoanPage({ searchParams }: { searchParams: Promise<{ property_id?: string; source_lead_id?: string }> }) {
  const user = await requireAgencyFeature("loans");
  if (!user.agency_id || user.role === "super_admin") notFound();
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const [typesResult,lendersResult,propertiesResult,leadsResult,fieldSettingsResult] = await Promise.all([
    db.from("loan_types").select("code,name").eq("is_active",true).order("sort_order"),
    db.from("lenders").select("id,name").eq("is_active",true).order("name"),
    db.from("properties").select("id,title").eq("agency_id",user.agency_id).order("title"),
    db.from("leads").select("id,name,phone,email,property_id").eq("agency_id",user.agency_id).order("created_at",{ascending:false}).limit(200),
    db.from("agency_loan_field_settings").select("enabled_fields").eq("agency_id", user.agency_id).maybeSingle(),
  ]);
  const types=supabaseData(typesResult.data,typesResult.error,"Unable to load loan types");
  const lenders=supabaseData(lendersResult.data,lendersResult.error,"Unable to load lenders");
  const properties=supabaseData(propertiesResult.data,propertiesResult.error,"Unable to load properties");
  const enquiries=supabaseData(leadsResult.data,leadsResult.error,"Unable to load enquiries");
  const fieldSettings=supabaseData(fieldSettingsResult.data,fieldSettingsResult.error,"Unable to load loan field settings");
  const enabledFields=new Set<string>(fieldSettings?.enabled_fields||["first_name","middle_name","mother_name","father_name","date_of_birth","pincode","applicant_address"]);
  const enquiry=enquiries.find(x=>x.id===params.source_lead_id);
  if(params.source_lead_id&&!enquiry) notFound();
  const propertyId=params.property_id||enquiry?.property_id||"";
  return <WorkspaceShell theme="agency" defaultView="overview" allowedViews={[]}>
    <aside className="dashboard-sidebar">
      <Link className="dashboard-sidebar-brand" href="/dashboard"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></Link>
      <div className="dashboard-sidebar-account"><span className="dashboard-sidebar-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-sidebar-account-copy"><strong>{user.name}</strong><small>Agency workspace</small></span></div>
      <p className="dashboard-sidebar-label">WORKSPACE</p>
      <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav"><Link href="/dashboard">Overview</Link><Link href="/dashboard#inventory">Properties</Link><Link href="/dashboard#leads">Enquiries</Link><Link href="/dashboard/loans" aria-current="page">Loans</Link><Link href="/dashboard#team">Team</Link></nav>
      <div className="dashboard-sidebar-bottom"><Link className="dashboard-sidebar-public" href="/">View public website</Link><form action={logout}><button className="dashboard-sidebar-signout" type="submit">Sign out</button></form></div>
    </aside>
    <div className="dashboard-main"><header className="workspace-topbar"><div><span className="workspace-status-dot" /> Agency workspace</div><details className="dashboard-user-menu"><summary><span className="dashboard-user-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-user-copy"><strong>{user.name}</strong><small>{user.email}</small></span><span className="dashboard-user-chevron" aria-hidden="true">⌄</span></summary><div className="dashboard-user-menu-panel"><strong>{user.name}</strong><small>{user.email}</small><form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form></div></details></header>
    <main className="workspace editor"><p className="kicker">CUSTOMER FINANCING</p><h1>New loan <em>request.</em></h1><p className="muted">Complete the applicant details and send the request directly to the platform admin for review.</p>
    <LoanLeadActionForm type="send" className="panel dashboard-section form-grid">
      <label>Loan type<select name="loan_type" required>{types.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
      <input type="hidden" name="customer_name" value="Applicant"/>
      {enabledFields.has("first_name")&&<label>First name<input name="first_name" defaultValue={enquiry?.name.split(/\s+/)[0]||""} maxLength={80} required/></label>}
      {enabledFields.has("middle_name")&&<label>Middle name<input name="middle_name" maxLength={80} required/></label>}
      {enabledFields.has("mother_name")&&<label>Mother's name<input name="mother_name" maxLength={150} required/></label>}
      {enabledFields.has("father_name")&&<label>Father's name<input name="father_name" maxLength={150} required/></label>}
      {enabledFields.has("date_of_birth")&&<label>Date of birth<input name="date_of_birth" type="date" required/></label>}
      <label>Phone<input name="phone" defaultValue={enquiry?.phone||""} required/></label><label>Email<input name="email" type="email" defaultValue={enquiry?.email||""} required/></label>
      <PincodeAddressFields enabledPincode={enabledFields.has("pincode")} enabledAddress={enabledFields.has("applicant_address")} initialCity=""/>
      <label>Employment type<select name="employment_type"><option value="salaried">Salaried</option><option value="self_employed">Self-employed</option><option value="business_owner">Business owner</option><option value="other">Other</option></select></label>
      <label>Monthly income (₹)<input name="monthly_income" type="number" min="1" step="0.01" required/></label><label>Loan amount requested (₹)<input name="loan_amount" type="number" min="1" step="0.01" required/></label>
      <label>Tenure (months)<input name="tenure_months" type="number" min="1" max="600" required/></label>
      <label>Linked property<select name="property_id" defaultValue={propertyId}><option value="">None</option>{properties.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label>Linked enquiry<select name="source_lead_id" defaultValue={enquiry?.id||""}><option value="">None</option>{enquiries.map(x=><option key={x.id} value={x.id}>{x.name} · {x.phone}</option>)}</select></label>
      <label>Preferred lender<select name="preferred_lender_id"><option value="">No preference</option>{lenders.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Notes<textarea name="notes" maxLength={4000}/></label><p className="muted">No identity or other documents are requested. Only the fields enabled for your agency are collected and shared with the platform admin after you submit.</p><label><input type="checkbox" name="consent" value="true"/> Customer consent received</label>
      <button className="btn">Send to admin</button><Link href="/dashboard/loans">Cancel</Link>
    </LoanLeadActionForm>
    </main></div>
  </WorkspaceShell>;
}
