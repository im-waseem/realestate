"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/dashboard/submit-button";

export function AcceptInviteForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function accept(formData: FormData) {
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("confirmation") || "");
    if (password.length < 12 || password.length > 128) { setMessage("Use a password between 12 and 128 characters."); return; }
    if (password !== confirmation) { setMessage("The passwords do not match."); return; }
    setSaving(true); setMessage("");
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("This invitation link is invalid or has expired. Ask your admin to send a new one.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to accept this invitation.");
    } finally { setSaving(false); }
  }

  return <form action={accept} className="stack">
    <label>Password<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    <label>Confirm password<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
    {message && <p role="alert">{message}</p>}
    <SubmitButton disabled={saving} pendingLabel="Saving password…">Join workspace</SubmitButton>
  </form>;
}
