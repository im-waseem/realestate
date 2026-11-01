import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createLead } from "@/app/actions";
import { PlatformHeader, Notice } from "@/components/platform";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
export default async function NewLead({searchParams}:{searchParams:Promise<{message?:string}>}) {
  const user=await requireUser(),query=await searchParams;
  const supabase=await createSupabaseServerClient();
  let agencies:{id:string;name:string}[]=[];
  if(user.role==="super_admin"){
    const result=await supabase.from("agencies").select("id,name").order("name");
    agencies=supabaseData(result.data,result.error,"Unable to load agencies");
  }
  if(user.role!=="super_admin"&&!user.agency_id) notFound();
  return <><PlatformHeader/><main className="workspace editor"><p className="kicker">CUSTOMER REQUIREMENTS</p><h1>Every enquiry.<br/><em>A new possibility.</em></h1><Notice message={query.message}/><form action={createLead} className="panel stack">
    {user.role==="super_admin"&&<label>Agency<select name="agency_id" required defaultValue=""><option value="" disabled>Select agency</option>{agencies.map(agency=><option key={agency.id} value={agency.id}>{agency.name}</option>)}</select></label>}
    <div className="form-grid"><label>Customer name<input name="name" required maxLength={100}/></label><label>Phone<input name="phone" type="tel" required maxLength={25}/></label><label>Email<input name="email" type="email" required maxLength={254}/></label><label>Looking to<select name="intent">{["buy","sell","rent","lease"].map(i=><option key={i}>{i}</option>)}</select></label></div><label>Requirements<textarea name="requirements" required maxLength={2000} placeholder="Preferred locality, budget, bedrooms, move-in date, and any other requirements."/></label><button className="btn">Save customer requirement →</button></form></main></>;
}
