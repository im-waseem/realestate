"use client";

import type { ReactNode } from "react";

export function ConfirmDeleteButton({
  children = "Delete",
  confirmMessage,
  disabled = false,
  title,
}: {
  children?: ReactNode;
  confirmMessage: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className="btn small danger-button"
      type="submit"
      disabled={disabled}
      title={title}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
