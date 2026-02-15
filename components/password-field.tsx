"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = {
  label: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function EyeIcon({ hide }: { hide: boolean }) {
  if (hide) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M2 12s3.5-6.5 10-6.5S20 12 20 12s-3.5 6.5-10 6.5S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.22 19.78 19.78 4.22"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M2 12s3.5-6.5 10-6.5S20 12 20 12s-3.5 6.5-10 6.5S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PasswordField({ label, id, className = "", ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="password-field" htmlFor={inputId}>
      <span className="password-field-label">{label}</span>
      <div className="password-field-control">
        <input
          id={inputId}
          type={showPassword ? "text" : "password"}
          className={`password-field-input ${className}`}
          {...props}
        />
        <button
          type="button"
          className="password-field-toggle"
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
        >
          <EyeIcon hide={showPassword} />
        </button>
      </div>
    </label>
  );
}

