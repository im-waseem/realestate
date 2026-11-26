"use client";
import { useActionState } from "react";
import { saveAgencyLoanLead, submitAgencyLoanLead, updateAdminLoanLead } from "@/app/actions";

type ActionType = "save" | "submit" | "admin";
type State = { ok: boolean; message: string } | null;
export function LoanLeadActionForm({ type, className, children }: { type: ActionType; className?: string; children: React.ReactNode }) {
  const action = type === "save" ? saveAgencyLoanLead : type === "submit" ? submitAgencyLoanLead : updateAdminLoanLead;
  const [state, formAction, pending] = useActionState(async (_previous: State, formData: FormData) => action(formData), null);
  return <form action={formAction} className={className}>{children}{state && <p role="status" aria-live="polite">{state.message}</p>}{pending && <p aria-live="polite">Saving…</p>}</form>;
}
