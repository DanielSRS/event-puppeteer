/**
 * Chooses a new password with the token from the emailed link.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ValidateNewPassword, type NewPasswordErrors } from "@/utils/validation/UserValidation";
import { AUTH_CARD, AUTH_FIELD, AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AUTH_TITLE } from "./auth-styles";

export type ResetPasswordFormProps = {
  /** Whether the page was opened with a token; without one there is nothing to reset. */
  hasToken: boolean;
  /** While the new password is saved. */
  saving: boolean;
  /** Why the last attempt failed. */
  error: string;
  /** The link is invalid, expired or already used: offer to ask for a new one. */
  linkExpired: boolean;
  onSubmit: (password: string) => void;
};

/** New password typed twice; each field shows its own error. */
export function ResetPasswordForm({ hasToken, saving, error, linkExpired, onSubmit }: ResetPasswordFormProps) {
  const ids = { title: useId(), password: useId(), confirmation: useId() };
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<NewPasswordErrors>({});

  if (!hasToken || linkExpired) {
    return (
      <section className={AUTH_CARD} aria-labelledby={ids.title}>
        <h1 id={ids.title} className={AUTH_TITLE}>Escolha uma nova senha</h1>
        <ErrorAlert>
          {hasToken
            ? "Este link é inválido, expirou ou já foi usado."
            : "O link de redefinição está incompleto. Abra o link exatamente como chegou no e-mail."}
        </ErrorAlert>
        <Link href="/esqueci-senha" className={`${AUTH_SUBMIT} focus-ring`}>Pedir um novo link</Link>
      </section>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = ValidateNewPassword(password, confirmation);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(password);
  };

  const field = (key: "password" | "confirmation", label: string, value: string, onChange: (value: string) => void) => (
    <div className={AUTH_FIELD}>
      <label htmlFor={ids[key]} className={AUTH_LABEL}>{label}</label>
      <input
        id={ids[key]}
        type="password"
        value={value}
        disabled={saving}
        onChange={(event) => onChange(event.target.value)}
        className={`${AUTH_INPUT} ${errors[key] !== undefined ? "input-error" : ""}`}
        autoComplete="new-password"
        aria-invalid={errors[key] !== undefined}
        aria-describedby={errors[key] !== undefined ? `${ids[key]}-error` : undefined}
      />
      {errors[key] !== undefined && <span id={`${ids[key]}-error`} className={AUTH_FIELD_ERROR}>{errors[key]}</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className={AUTH_CARD} aria-labelledby={ids.title}>
      <h1 id={ids.title} className={AUTH_TITLE}>Escolha uma nova senha</h1>
      <p className="t2">
        Pelo menos 8 caracteres. Depois de salvar, você sai das sessões abertas e entra de novo com a nova senha.
      </p>

      {field("password", "Nova senha", password, setPassword)}
      {field("confirmation", "Repita a nova senha", confirmation, setConfirmation)}

      <ErrorAlert>{error}</ErrorAlert>

      <button type="submit" disabled={saving} className={AUTH_SUBMIT}>
        {saving ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
