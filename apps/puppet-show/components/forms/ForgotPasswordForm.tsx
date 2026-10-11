/**
 * "Esqueci minha senha": asks for the account's e-mail and sends a link to
 * choose a new password.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ValidateEmail } from "@/utils/validation/UserValidation";

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
    <section className="card column gap-4 w-full max-w-md" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`} className="title text-center">Esqueci minha senha</h1>

      {sent ? (
        <>
          <StatusMessage>
            Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. O link vale por 1 hora; confira também a caixa de spam.
          </StatusMessage>
          <Link href="/entrar" className="button clean touch">Voltar para o login</Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="column gap-4">
          <p className="text-sm text-foreground/80">
            Informe o e-mail da sua conta. Enviaremos um link para você escolher uma nova senha.
          </p>

          <div className="column">
            <label htmlFor={id}>E-mail</label>
            <input
              id={id}
              type="email"
              value={email}
              disabled={sending}
              onChange={(event) => setEmail(event.target.value)}
              className={`input min-h-11 ${emailError !== null ? "input-error" : ""}`}
              placeholder="voce@email.com"
              autoComplete="email"
              aria-invalid={emailError !== null}
              aria-describedby={emailError !== null ? `${id}-error` : undefined}
            />
            {emailError !== null && <span id={`${id}-error`} className="error-message">{emailError}</span>}
          </div>

          <ErrorAlert>{error}</ErrorAlert>

          <button type="submit" disabled={sending} className="button main touch">
            {sending ? "Enviando..." : "Enviar link"}
          </button>
          <Link href="/entrar" className="text-sm text-center text-main underline">Voltar para o login</Link>
        </form>
      )}
    </section>
  );
}
