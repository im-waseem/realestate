import Link from "next/link";
import { LoanLeadActionForm } from "@/components/dashboard/loan-lead-action-form";
import { requireAgencyFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { notFound } from "next/navigation";

export default async function NewLoanPage({ searchParams }: { searchParams: Promise<{ property_id?: string; source_lead_id?: string }> }) {
  const user = await requireAgencyFeature("loans");
  if (!user.agency_id || user.role === "super_admin") notFound();
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const [typesResult,lendersResult,propertiesResult,leadsResult] = await Promise.all([
    db.from("loan_types").select("code,name").eq("is_active",true).order("sort_order"),
    db.from("lenders").select("id,name").eq("is_active",true).order("name"),
    db.from("properties").select("id,title").eq("agency_id",user.agency_id).order("title"),
    db.from("leads").select("id,name,phone,email,property_id").eq("agency_id",user.agency_id).order("created_at",{ascending:false}).limit(200),
  ]);
  const types=supabaseData(typesResult.data,typesResult.error,"Unable to load loan types");
  const lenders=supabaseData(lendersResult.data,lendersResult.error,"Unable to load lenders");
  const properties=supabaseData(propertiesResult.data,propertiesResult.error,"Unable to load properties");
  const enquiries=supabaseData(leadsResult.data,leadsResult.error,"Unable to load enquiries");
  const enquiry=enquiries.find(x=>x.id===params.source_lead_id);
  if(params.source_lead_id&&!enquiry) notFound();
  const propertyId=params.property_id||enquiry?.property_id||"";
  return <main className="workspace editor"><p className="kicker">CUSTOMER FINANCING</p><h1>New loan <em>request.</em></h1><p className="muted">Save as a draft and submit when the details and customer consent are complete.</p>
    <LoanLeadActionForm type="save" className="panel dashboard-section form-grid">
      <label>Loan type<select name="loan_type" required>{types.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
      <label>Customer name<input name="customer_name" defaultValue={enquiry?.name||""} maxLength={100} required/></label>
      <label>Phone<input name="phone" defaultValue={enquiry?.phone||""} required/></label><label>Email<input name="email" type="email" defaultValue={enquiry?.email||""}/></label>
      <label>City<input name="city" required/></label><label>Employment type<select name="employment_type"><option value="salaried">Salaried</option><option value="self_employed">Self-employed</option><option value="business_owner">Business owner</option><option value="other">Other</option></select></label>
      <label>Monthly income (₹)<input name="monthly_income" type="number" min="1" step="0.01" required/></label><label>Loan amount requested (₹)<input name="loan_amount" type="number" min="1" step="0.01" required/></label>
      <label>Tenure (months)<input name="tenure_months" type="number" min="1" max="600" required/></label>
      <label>Linked property<select name="property_id" defaultValue={propertyId}><option value="">None</option>{properties.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label>Linked enquiry<select name="source_lead_id" defaultValue={enquiry?.id||""}><option value="">None</option>{enquiries.map(x=><option key={x.id} value={x.id}>{x.name} · {x.phone}</option>)}</select></label>
      <label>Preferred lender<select name="preferred_lender_id"><option value="">No preference</option>{lenders.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Notes<textarea name="notes" maxLength={4000}/></label><label><input type="checkbox" name="consent" value="true"/> Customer consent received</label>
      <button className="btn">Save draft</button><Link href="/dashboard/loans">Cancel</Link>
    </LoanLeadActionForm>
  </main>;
}
