/**
 * Shown right after sign-up: the account only works after the emailed link is opened.
 * A glass card with a mail tile, the address in bold and the two ways forward side by side.
 *
 * @module
 */

import Link from "next/link";
import { MdMarkEmailRead } from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { AUTH_CARD, AUTH_TITLE } from "./auth-styles";

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
    <section aria-labelledby="verify-title" className={`${AUTH_CARD} items-start`}>
      <span aria-hidden className="center h-16 w-16 rounded-[20px] bg-accent-soft text-main">
        <MdMarkEmailRead className="h-[30px] w-[30px]" />
      </span>

      <h1 id="verify-title" className={AUTH_TITLE}>Confirme seu e-mail</h1>

      <p className="t2">
        Enviamos um link de confirmação para <strong className="font-semibold text-foreground">{email}</strong>. Abra o link para ativar sua conta e depois faça login.
      </p>

      {resent && <StatusMessage className="w-full">Se o e-mail estiver cadastrado, um novo link foi enviado.</StatusMessage>}
      <ErrorAlert className="w-full">{error}</ErrorAlert>

      <div className="flex w-full flex-wrap gap-2">
        <Link href="/entrar" className="button main flex-1 basis-40 focus-ring">
          Ir para o login
        </Link>
        <button type="button" onClick={onResend} disabled={resending} className="button flex-1 basis-40">
          {resending ? "Enviando..." : "Reenviar e-mail"}
        </button>
      </div>
    </section>
  );
}
