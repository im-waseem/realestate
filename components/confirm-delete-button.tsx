"use client";

import { useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmDeleteButton({ children = "Delete", confirmMessage, disabled = false, title }: {
  children?: ReactNode;
  confirmMessage: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  return <>
    <button ref={button} className="btn small danger-button" type="submit" disabled={disabled || pending} aria-busy={pending} title={title}
      onClick={event => { event.preventDefault(); dialog.current?.showModal(); }}>
      {pending ? "Deleting…" : children}
    </button>
    <dialog ref={dialog} className="delete-confirmation" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <span className="delete-confirmation-icon" aria-hidden="true">!</span>
      <h2 id={`${id}-title`}>Confirm removal</h2>
      <p id={`${id}-description`}>{confirmMessage}</p>
      <div className="delete-confirmation-actions">
        <button type="button" className="btn workspace-secondary" autoFocus onClick={() => dialog.current?.close()}>Keep record</button>
        <button type="button" className="btn danger-button" onClick={() => {
          dialog.current?.close();
          const submitter = button.current;
          if (submitter?.form) submitter.form.requestSubmit(submitter);
        }}>Confirm removal</button>
      </div>
    </dialog>
  </>;
}
