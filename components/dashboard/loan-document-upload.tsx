"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoanDocumentUpload({ leadId }: { leadId: string }) {
  const router = useRouter(); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function upload(formData: FormData) {
    setBusy(true);setMessage("");
    try { const response=await fetch("/api/loan-documents",{method:"POST",body:formData});const result=await response.json();if(!response.ok)throw new Error(result.error||"Upload failed.");setMessage("Document uploaded.");router.refresh(); }
    catch(error){setMessage(error instanceof Error?error.message:"Upload failed.");} finally{setBusy(false);}
  }
  return <form action={upload} className="form-grid"><input type="hidden" name="lead_id" value={leadId}/><label>Document type<select name="doc_type">{["id","address","income","bank_statements","property_papers"].map(x=><option key={x}>{x}</option>)}</select></label><label>File<input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required/></label><button className="btn small" disabled={busy}>{busy?"Uploading…":"Upload"}</button>{message&&<p role="status">{message}</p>}</form>;
}
