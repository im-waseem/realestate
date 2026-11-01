"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, className = "btn", pendingLabel = "Saving…" }: { children: ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>
    {pending && <span className="submit-spinner" aria-hidden="true" />}
    <span aria-live="polite">{pending ? pendingLabel : children}</span>
  </button>;
}
