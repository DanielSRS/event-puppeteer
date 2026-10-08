/**
 * Shown right after sign-up: the account only works after the emailed link is opened.
 *
 * @module
 */

import Link from "next/link";
import { MdMarkEmailRead } from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";

export type VerifyEmailNoticeProps = {
  /** Where the link was sent. */
  email: string;
  resending?: boolean;
  /** True after a resend, so the person knows the click worked. */
  resent?: boolean;
  /** Why the last resend failed. */
  error?: string;
  onResend: () => void;
};

/** Says where the confirmation went, offers to resend it and links to the login. */
export function VerifyEmailNotice({ email, resending = false, resent = false, error = "", onResend }: VerifyEmailNoticeProps) {
  return (
    <section aria-labelledby="verify-title" className="card column gap-4 w-full max-w-md text-center items-center">
      <MdMarkEmailRead className="w-12 h-12 text-main" aria-hidden />

      <h1 id="verify-title" className="title">Confirme seu e-mail</h1>

      <p className="text-sm">
        Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar sua conta e depois faça login.
      </p>

      {resent && <StatusMessage className="text-left">Se o e-mail estiver cadastrado, um novo link foi enviado.</StatusMessage>}
      <ErrorAlert className="text-left">{error}</ErrorAlert>

      <button type="button" onClick={onResend} disabled={resending} className="button clean touch w-full">
        {resending ? "Enviando..." : "Reenviar e-mail"}
      </button>

      <Link href="/entrar" className="text-sm text-main underline">
        Ir para o login
      </Link>
    </section>
  );
}
