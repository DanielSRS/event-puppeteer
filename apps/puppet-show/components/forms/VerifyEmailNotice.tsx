/* components/forms/VerifyEmailNotice.tsx */

import Link from "next/link";
import { MdMarkEmailRead } from "react-icons/md";

type VerifyEmailNoticeProps = {
  email: string;
  resending?: boolean;
  /* TRUE AFTER A RESEND, SO THE PERSON KNOWS THE CLICK WORKED */
  resent?: boolean;
  onResend: () => void;
};

/* SHOWN RIGHT AFTER SIGN-UP: THE ACCOUNT ONLY WORKS AFTER THE EMAIL LINK IS OPENED */
export function VerifyEmailNotice({ email, resending = false, resent = false, onResend }: VerifyEmailNoticeProps) {
  return (
    <section className="card column gap-4 w-full max-w-md text-center items-center">
      <MdMarkEmailRead className="w-12 h-12 text-main" aria-hidden />

      <h1 className="title">Confirme seu e-mail</h1>

      <p className="text-sm">
        Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link para ativar sua conta e depois faça login.
      </p>

      {resent && (
        <p role="status" className="text-sm text-success">
          Se o e-mail estiver cadastrado, um novo link foi enviado.
        </p>
      )}

      <button type="button" onClick={onResend} disabled={resending} className="button clean w-full">
        {resending ? "Enviando..." : "Reenviar e-mail"}
      </button>

      <Link href="/entrar" className="text-sm text-main underline">
        Ir para o login
      </Link>
    </section>
  );
};
