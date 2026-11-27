"use client";

import { useState } from "react";

export function PasswordInput({ name, autoComplete, required = false, maxLength }: {
  name: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input
        id="login-password"
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
      />
      <button
        className="password-visibility"
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls="login-password"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11.8 11.8 0 0 1 12 5c5 0 8.3 4.2 9.5 6.4a1.2 1.2 0 0 1 0 1.2 15 15 0 0 1-3.1 3.8" /><path d="M6.2 6.2a15.4 15.4 0 0 0-3.7 5.2 1.2 1.2 0 0 0 0 1.2C3.7 14.8 7 19 12 19a11 11 0 0 0 4-.7" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" />
          </svg>
        )}
      </button>
    </span>
  );
}
