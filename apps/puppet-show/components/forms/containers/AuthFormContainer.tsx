/* components/forms/containers/AuthFormContainer.tsx */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm, AuthFormData } from "../AuthForm";
import { VerifyEmailNotice } from "../VerifyEmailNotice";
import { StartSession } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "@/lib/api/session";
import { MIN_PASSWORD_LENGTH } from "@/utils/validation/UserValidation";

/* THE FORM ASKS FOR ONE NAME; THE API WANTS FIRST AND LAST */
function SplitName(name = "") {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
};

type AuthFormContainerProps = {
  mode: "login" | "register";
};

export function AuthFormContainer({ mode }: AuthFormContainerProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ONLY INTERNAL ADDRESSES, SO NOBODY USES THE LINK TO SEND PEOPLE TO ANOTHER SITE */
  const rawRedirect = searchParams.get("redirect") ?? "";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  /* THE API SENDS PEOPLE BACK HERE AFTER THEY OPEN THE CONFIRMATION LINK */
  const emailVerified = searchParams.get("emailVerified");
  const notice = emailVerified === "1" ? "E-mail confirmado, faça login." : "";
  const linkError = emailVerified === "0"
    ? "Link inválido ou expirado. Entre com seu e-mail e senha para receber um novo."
    : "";

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState(linkError);

  /* THE EMAIL WAITING FOR CONFIRMATION: AFTER SIGN-UP, OR A LOGIN BLOCKED BY IT */
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [registered, setRegistered] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);

    try {
      await api.auth.resendVerification(unverifiedEmail);
      setResent(true);
      if (!registered)
        setGeneralError("Enviamos um novo link de confirmação. Verifique sua caixa de entrada.");
    } catch {
      setGeneralError("Não foi possível reenviar o e-mail.");
    } finally {
      setResending(false);
    };
  };

  async function handleSubmit(data: AuthFormData) {
    setGeneralError("");
    setUnverifiedEmail("");
    setResent(false);
    setLoading(true);

    try {
      if (isRegister) {
        /* SIGN-UP ALWAYS JOINS AN ORGANIZATION; WITHOUT ONE CONFIGURED THERE IS NOTHING TO JOIN */
        if (!PUBLIC_ORG_ID) {
          setGeneralError(MISSING_ORG_MESSAGE);
          return;
        };

        /* NO SESSION YET: THE ACCOUNT ONLY WORKS AFTER THE EMAIL IS CONFIRMED */
        await api.auth.register({ ...SplitName(data.name), email: data.email, password: data.password }, PUBLIC_ORG_ID);
        setUnverifiedEmail(data.email);
        setRegistered(true);
        return;
      };

      const { token } = await api.auth.login({ email: data.email, password: data.password });

      StartSession(token);
      router.push(redirect);
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError))
        setGeneralError("Erro de conexão com o servidor.");
      else if (!isRegister && err.status === 403) {
        setUnverifiedEmail(data.email);
        setGeneralError("Seu e-mail ainda não foi confirmado.");
      }
      else if (!isRegister)
        setGeneralError("E-mail ou senha incorretos.");
      else if (err.status === 422)
        setGeneralError(`Dados inválidos. A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      else if (err.status === 400 && err.message === "Organization not found")
        setGeneralError("Organização não encontrada. Verifique NEXT_PUBLIC_ORG_ID.");
      else if (err.status === 400)
        setGeneralError("Este e-mail já está cadastrado.");
      else
        setGeneralError("Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    };
  };

  if (registered)
    return (
      <VerifyEmailNotice
        email={unverifiedEmail}
        resending={resending}
        resent={resent}
        onResend={handleResend}
      />
    );

  return (
    <AuthForm
      mode={mode}
      loading={loading}
      generalError={generalError}
      notice={notice}
      redirectPath={redirect}
      onResendVerification={unverifiedEmail && !resent ? handleResend : undefined}
      resending={resending}
      onSubmit={handleSubmit}
    />
  );
};
