import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanLeadActionForm } from "@/components/dashboard/loan-lead-action-form";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { loanStatusLabel } from "@/lib/loan-status";

export default async function AdminLoanDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();
  const { id } = await params;
  const db = await createSupabaseServerClient();
  const [leadResult, historyResult, lendersResult] = await Promise.all([
    db.from("loan_leads_admin_v").select("*").eq("id", id).maybeSingle(),
    db.from("loan_lead_history").select("actor_name,event_type,from_status,to_status,remark,created_at").eq("loan_lead_id", id).order("created_at"),
    db.from("lenders").select("id,name").order("name"),
  ]);
  const lead = supabaseData(leadResult.data, leadResult.error, "Unable to load loan request");
  if (!lead) notFound();
  const history = supabaseData(historyResult.data, historyResult.error, "Unable to load history");
  const lenders = supabaseData(lendersResult.data, lendersResult.error, "Unable to load lenders");
  return <main className="workspace editor">
    <p className="kicker">{lead.agency_name} · {loanStatusLabel(lead.status)}</p><h1>{lead.customer_name}</h1>
    <section className="panel dashboard-section"><h2>Applicant details</h2><dl className="form-grid">
      <div><dt>First name</dt><dd>{lead.first_name || "Not collected"}</dd></div><div><dt>Middle name</dt><dd>{lead.middle_name || "Not collected"}</dd></div>
      <div><dt>Mother's name</dt><dd>{lead.mother_name || "Not collected"}</dd></div><div><dt>Father's name</dt><dd>{lead.father_name || "Not collected"}</dd></div>
      <div><dt>Date of birth</dt><dd>{lead.date_of_birth || "Not collected"}</dd></div><div><dt>Phone</dt><dd>{lead.phone}</dd></div>
      <div><dt>Email</dt><dd>{lead.email || "Not provided"}</dd></div><div><dt>PIN code</dt><dd>{lead.pincode || "Not collected"}</dd></div>
      <div><dt>Address</dt><dd>{lead.applicant_address || "Not collected"}</dd></div><div><dt>City / district</dt><dd>{lead.city}</dd></div>
      <div><dt>Loan type</dt><dd>{lead.loan_type_name}</dd></div><div><dt>Amount requested</dt><dd>₹{Number(lead.loan_amount).toLocaleString("en-IN")}</dd></div>
      <div><dt>Monthly income</dt><dd>₹{Number(lead.monthly_income).toLocaleString("en-IN")}</dd></div><div><dt>Employment</dt><dd>{lead.employment_type.replaceAll("_", " ")}</dd></div><div><dt>Tenure</dt><dd>{lead.tenure_months} months</dd></div>
    </dl><p className="muted">No documents are requested or stored in the loan application flow.</p></section>
    <section className="panel dashboard-section"><h2>Admin review</h2><LoanLeadActionForm type="admin" className="form-grid"><input type="hidden" name="id" value={id}/><label>Status<select name="status" defaultValue={lead.status}>{["submitted_to_admin","under_review","sanctioned","rejected","info_requested","disbursed","cancelled"].map((x)=><option key={x} value={x}>{loanStatusLabel(x)}</option>)}</select></label><label>Admin remarks / reason<textarea name="admin_remarks" defaultValue={lead.admin_remarks}/></label><label>Assigned lender<select name="assigned_lender_id" defaultValue={lead.assigned_lender_id || ""}><option value="">None</option>{lenders.map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Approved amount (optional)<input name="sanctioned_amount" type="number" min="0" step="0.01" defaultValue={lead.sanctioned_amount || ""}/></label><label>Approval date (optional)<input name="sanctioned_at" type="date" defaultValue={lead.sanctioned_at || ""}/></label><label>Disbursed amount<input name="disbursed_amount" type="number" min="0" step="0.01" defaultValue={lead.disbursed_amount || ""}/></label><label>Disbursed date<input name="disbursed_at" type="date" defaultValue={lead.disbursed_at || ""}/></label><button className="btn">Update status</button></LoanLeadActionForm></section>
    <section className="panel dashboard-section"><h2>History</h2>{history.map((x, i)=><p key={i}>{loanStatusLabel(x.to_status || x.event_type)} · {x.actor_name} · {new Date(x.created_at).toLocaleString()} · {x.remark}</p>)}</section>
    <Link href="/dashboard/admin/loans">Back to all loans</Link>
  </main>;
}
