"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, className = "btn", pendingLabel = "Saving…", disabled = false }: { children: ReactNode; className?: string; pendingLabel?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending || disabled}>
    {pending && <span className="submit-spinner" aria-hidden="true" />}
    <span aria-live="polite">{pending ? pendingLabel : children}</span>
  </button>;
}
