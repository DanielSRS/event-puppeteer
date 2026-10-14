/**
 * "Esqueci minha senha": asks for the account's e-mail and sends a link to
 * choose a new password.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ValidateEmail } from "@/utils/validation/UserValidation";
import { AUTH_CARD, AUTH_FIELD, AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AUTH_TITLE } from "./auth-styles";

export type ForgotPasswordFormProps = {
  /** While the request runs. */
  sending: boolean;
  /** The link was requested; the form is replaced by what to do next. */
  sent: boolean;
  /** Why the last request failed. */
  error: string;
  onSubmit: (email: string) => void;
};

/**
 * The form. After sending it says the same whether or not the address has an
 * account, like the API, so it can't be used to find accounts.
 */
export function ForgotPasswordForm({ sending, sent, error, onSubmit }: ForgotPasswordFormProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = ValidateEmail(email);
    setEmailError(found);
    if (found === null) onSubmit(email.trim());
  };

  return (
    <section className={AUTH_CARD} aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className={AUTH_TITLE}>Esqueci minha senha</h1>

      {sent ? (
        <>
          <StatusMessage>
            Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. O link vale por 1 hora; confira também a caixa de spam.
          </StatusMessage>
          <Link href="/entrar" className="button min-h-12 rounded-2xl focus-ring">Voltar para o login</Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="column gap-4">
          <p className="t2">
            Informe o e-mail da sua conta. Enviaremos um link para você escolher uma nova senha.
          </p>

          <div className={AUTH_FIELD}>
            <label htmlFor={id} className={AUTH_LABEL}>E-mail</label>
            <input
              id={id}
              type="email"
              value={email}
              disabled={sending}
              onChange={(event) => setEmail(event.target.value)}
              className={`${AUTH_INPUT} ${emailError !== null ? "input-error" : ""}`}
              placeholder="voce@email.com"
              autoComplete="email"
              aria-invalid={emailError !== null}
              aria-describedby={emailError !== null ? `${id}-error` : undefined}
            />
            {emailError !== null && <span id={`${id}-error`} className={AUTH_FIELD_ERROR}>{emailError}</span>}
          </div>

          <ErrorAlert>{error}</ErrorAlert>

          <button type="submit" disabled={sending} className={AUTH_SUBMIT}>
            {sending ? "Enviando..." : "Enviar link"}
          </button>
          <Link href="/entrar" className="button ghost text-fg-2 focus-ring">
            <MdArrowBack aria-hidden className="h-4 w-4" />
            Voltar para o login
          </Link>
        </form>
      )}
    </section>
  );
}
