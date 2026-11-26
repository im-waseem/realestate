import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function csv(value: unknown) { const s=String(value??""); return `"${s.replace(/"/g,'""')}"`; }
export async function GET(request:Request) {
 const user=await requireUser();if(user.role!=="super_admin")return new Response("Forbidden",{status:403});
 const params=new URL(request.url).searchParams;const db=await createSupabaseServerClient();let q=db.from("loan_leads_admin_v").select("agency_name,loan_type_name,lender_name,customer_name,phone,email,loan_amount,status,forwarded_at").order("forwarded_at",{ascending:false});
 for(const key of ["agency","status","type","lender"]){const value=params.get(key);const col={agency:"agency_id",status:"status",type:"loan_type",lender:"assigned_lender_id"}[key];if(value)q=q.eq(col as never,value as never);}
 const from=params.get("from"),to=params.get("to"),min=params.get("min"),max=params.get("max"),search=params.get("q")?.trim().replace(/[,%()]/g," ");
 if(from)q=q.gte("forwarded_at",from);if(to)q=q.lte("forwarded_at",`${to}T23:59:59`);if(min)q=q.gte("loan_amount",Number(min));if(max)q=q.lte("loan_amount",Number(max));if(search)q=q.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
 const {data,error}=await q.limit(10000);if(error)return new Response("Unable to export loan leads",{status:500});const rows=[["Agency","Loan type","Lender","Customer","Phone","Email","Amount","Status","Forwarded"],...(data||[]).map(x=>[x.agency_name,x.loan_type_name,x.lender_name,x.customer_name,x.phone,x.email,x.loan_amount,x.status,x.forwarded_at])];
 return new Response(rows.map(row=>row.map(csv).join(",")).join("\r\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=loan-applications.csv","cache-control":"no-store"}});
}
