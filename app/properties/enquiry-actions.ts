"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function submitPublicEnquiry(form: FormData) {
  const id=String(form.get("property_id")||"");
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error("Invalid property.");
  let message="";
  try {
    if(form.get("website")) throw new Error("Please try again.");
    const admin=createSupabaseAdminClient();
    const {error}=await admin.rpc("realty_submit_public_enquiry",{target_id:id,customer_name:String(form.get("name")||"").trim(),customer_phone:String(form.get("phone")||"").trim(),customer_email:String(form.get("email")||"").trim(),customer_message:String(form.get("message")||"").trim()});
    if(error) message = /Too many enquiries|no longer available|check your contact/.test(error.message) ? error.message : "Unable to send your enquiry. Please try again later.";
  } catch { message="Unable to send your enquiry. Please try again later."; }
  if(message) redirect(`/properties/${id}?message=${encodeURIComponent(message)}#enquire`);
  revalidatePath("/dashboard");
  redirect(`/properties/${id}?sent=1#enquire`);
}
