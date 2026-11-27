import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanLeadActionForm } from "@/components/dashboard/loan-lead-action-form";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { loanStatusLabel } from "@/lib/loan-status";

export default async function AgencyLoanDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAgencyFeature("loans");
  if (!user.agency_id || user.role === "super_admin") notFound();
  const { id } = await params;
  const db = await createSupabaseServerClient();
  const [leadResult, historyResult] = await Promise.all([
    db.from("loan_leads").select("*").eq("id", id).eq("agency_id", user.agency_id).maybeSingle(),
    db.from("loan_lead_history").select("actor_name,event_type,from_status,to_status,remark,created_at").eq("loan_lead_id", id).order("created_at"),
  ]);
  const lead = supabaseData(leadResult.data, leadResult.error, "Unable to load loan request");
  if (!lead) notFound();
  const history = supabaseData(historyResult.data, historyResult.error, "Unable to load status history");
  const editable = ["draft", "info_requested"].includes(lead.status);
  return <main className="workspace editor">
    <p className="kicker">LOAN REQUEST · {loanStatusLabel(lead.status).toUpperCase()}</p><h1>{[lead.first_name, lead.middle_name].filter(Boolean).join(" ") || lead.customer_name}</h1>
    <p className="muted">{lead.admin_remarks || "Track your request and respond to any information request from the admin."}</p>
    <section className="panel dashboard-section"><h2>Applicant details</h2><div className="form-grid"><p><strong>Mother:</strong> {lead.mother_name || "Not collected"}</p><p><strong>Father:</strong> {lead.father_name || "Not collected"}</p><p><strong>Date of birth:</strong> {lead.date_of_birth || "Not collected"}</p><p><strong>Phone:</strong> {lead.phone}</p><p><strong>Email:</strong> {lead.email}</p><p><strong>PIN:</strong> {lead.pincode || "Not collected"}</p><p><strong>Address:</strong> {lead.applicant_address || "Not collected"}</p><p><strong>City:</strong> {lead.city}</p><p><strong>Loan type:</strong> {lead.loan_type}</p><p><strong>Requested:</strong> ₹{Number(lead.loan_amount).toLocaleString("en-IN")}</p></div><p>No documents are requested or stored in the loan application flow.</p><p><strong>Admin remarks:</strong> {lead.admin_remarks || "No remarks yet."}</p></section>
    {editable && <LoanLeadActionForm type="submit" className="panel dashboard-section form-grid"><input type="hidden" name="id" value={id}/><label><input type="checkbox" name="consent" value="on" required/> Customer has consented to this loan application</label><button className="btn">Send to admin</button></LoanLeadActionForm>}
    <section className="panel dashboard-section"><h2>Status timeline</h2>{history.map((event, index)=><p key={index}><strong>{loanStatusLabel(event.to_status || event.event_type)}</strong> · {event.actor_name} · {new Date(event.created_at).toLocaleString()} {event.remark && `· ${event.remark}`}</p>)}</section><Link href="/dashboard/loans">Back to applications</Link>
  </main>;
}
