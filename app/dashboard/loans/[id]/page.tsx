import Link from "next/link";
import { notFound } from "next/navigation";
import { LoanLeadActionForm } from "@/components/dashboard/loan-lead-action-form";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { LoanDocumentUpload } from "@/components/dashboard/loan-document-upload";
      
export default async function AgencyLoanDetail({ params }: { params: Promise<{id:string}> }) {
  const user=await requireAgencyFeature("loans"); if(!user.agency_id||user.role==="super_admin") notFound();
  const {id}=await params; const db=await createSupabaseServerClient();
  const [leadResult,typesResult,lendersResult,docsResult,historyResult]=await Promise.all([
    db.from("loan_leads").select("*").eq("id",id).eq("agency_id",user.agency_id).maybeSingle(),
    db.from("loan_types").select("code,name").order("sort_order"),db.from("lenders").select("id,name").eq("is_active",true).order("name"),
    db.from("loan_documents").select("id,doc_type,file_name,created_at").eq("lead_id",id).order("created_at",{ascending:false}),
    db.from("loan_lead_history").select("actor_name,event_type,from_status,to_status,remark,created_at").eq("loan_lead_id",id).order("created_at"),
  ]);
  const lead=supabaseData(leadResult.data,leadResult.error,"Unable to load loan request"); if(!lead)notFound();
  const types=supabaseData(typesResult.data,typesResult.error,"Unable to load loan types"); const lenders=supabaseData(lendersResult.data,lendersResult.error,"Unable to load lenders");
  const docs=supabaseData(docsResult.data,docsResult.error,"Unable to load documents"); const history=supabaseData(historyResult.data,historyResult.error,"Unable to load status history");
  const editable=["draft","info_requested"].includes(lead.status);
  return <main className="workspace editor"><p className="kicker">LOAN REQUEST · {lead.status.toUpperCase()}</p><h1>{lead.customer_name}</h1><p className="muted">{lead.admin_remarks||"Track your request and respond to any information request from the admin."}</p>
    {editable?<LoanLeadActionForm type="save" className="panel dashboard-section form-grid"><input type="hidden" name="id" value={id}/>
      <label>Loan type<select name="loan_type" defaultValue={lead.loan_type}>{types.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label><label>Customer name<input name="customer_name" defaultValue={lead.customer_name} required/></label><label>Phone<input name="phone" defaultValue={lead.phone} required/></label><label>Email<input name="email" type="email" defaultValue={lead.email}/></label><label>City<input name="city" defaultValue={lead.city} required/></label><label>Employment<select name="employment_type" defaultValue={lead.employment_type}>{["salaried","self_employed","business_owner","other"].map(x=><option key={x}>{x}</option>)}</select></label><label>Monthly income<input name="monthly_income" type="number" min="1" step="0.01" defaultValue={lead.monthly_income} required/></label><label>Requested amount<input name="loan_amount" type="number" min="1" step="0.01" defaultValue={lead.loan_amount} required/></label><label>Tenure (months)<input name="tenure_months" type="number" min="1" max="600" defaultValue={lead.tenure_months} required/></label><label>Preferred lender<select name="preferred_lender_id" defaultValue={lead.preferred_lender_id||""}><option value="">No preference</option>{lenders.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label><input type="checkbox" name="consent" value="true" defaultChecked={lead.consent}/> Customer consent received</label><label>Notes<textarea name="notes" defaultValue={lead.notes}/></label><button className="btn">Save changes</button></LoanLeadActionForm>:<section className="panel dashboard-section"><p>This request is read-only after submission.</p><p><strong>Admin remarks:</strong> {lead.admin_remarks||"No remarks yet."}</p><p>Requested ₹{Number(lead.loan_amount).toLocaleString("en-IN")} · {lead.tenure_months} months · {lead.employment_type}</p></section>}
    {editable&&<LoanLeadActionForm type="submit" className="panel dashboard-section form-grid"><input type="hidden" name="id" value={id}/><label><input type="checkbox" name="consent" value="on" required/> Customer has consented to this loan application</label><button className="btn">Submit to admin</button></LoanLeadActionForm>}
    <section className="panel dashboard-section"><h2>Documents</h2>{editable&&<LoanDocumentUpload leadId={id}/ >}{docs.map(doc=><p key={doc.id}><a href={`/api/loan-documents/${doc.id}`}>{doc.file_name}</a> · {doc.doc_type}</p>)}</section>
    <section className="panel dashboard-section"><h2>Status timeline</h2>{history.map((event,i)=><p key={i}><strong>{event.to_status||event.event_type}</strong> · {event.actor_name} · {new Date(event.created_at).toLocaleString()} {event.remark&&`· ${event.remark}`}</p>)}</section><Link href="/dashboard/loans">Back to applications</Link>
  </main>;
}
