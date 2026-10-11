/**
 * Connects the login and sign-up forms to the API.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StartSession } from "@/hooks/useAuth";
import { api, ApiErrorMessage, type ApiError } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "@/lib/api/session";
import { SplitName } from "@/utils/text";
import { MIN_PASSWORD_LENGTH, SafeRedirect } from "@/utils/validation/UserValidation";
import { AuthForm, type AuthFormData } from "../AuthForm";
import { VerifyEmailNotice } from "../VerifyEmailNotice";

export type AuthFormContainerProps = {
  mode: "login" | "register";
};

/** What the person reads when login fails. */
function LoginErrorMessage(error: ApiError): string {
  if (error.kind === "http" && error.status === 401) return "E-mail ou senha incorretos.";
  if (error.kind === "http" && error.status === 403) return "Seu e-mail ainda não foi confirmado. Abra o link que enviamos ou peça um novo.";
  return ApiErrorMessage(error);
}

/** What the person reads when sign-up fails; the API's own error text tells the 400 cases apart. */
function RegisterErrorMessage(error: ApiError): string {
  if (error.kind === "http" && error.status === 400 && error.message === "Organization not found")
    return "A organização configurada não existe. Verifique NEXT_PUBLIC_ORG_ID.";
  if (error.kind === "http" && error.status === 400 && error.message === "Email already exists")
    return "Este e-mail já está cadastrado. Entre com ele ou use outro.";
  if (error.kind === "http" && error.status === 422)
    return `Dados recusados pelo servidor. Confira o e-mail e use uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return ApiErrorMessage(error);
}

/**
 * Login keeps `?redirect=` and goes there after success; a 403 (email not
 * confirmed) offers to resend the link. Sign-up joins the public organization
 * and then shows {@link VerifyEmailNotice}. The API sends people back to the
 * login page with `?emailVerified=1|0` after they open the emailed link; the
 * password-reset page sends them here with `?senhaRedefinida=1`.
 */
export function AuthFormContainer({ mode }: AuthFormContainerProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = SafeRedirect(searchParams.get("redirect"));

  const emailVerified = searchParams.get("emailVerified");
  const notice = emailVerified === "1"
    ? "E-mail confirmado, faça login."
    : searchParams.get("senhaRedefinida") === "1" ? "Senha alterada. Entre com a nova senha." : "";
  const linkError = emailVerified === "0"
    ? "Link inválido ou expirado. Entre com seu e-mail e senha para receber um novo."
    : "";

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState(linkError);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [registered, setRegistered] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    setResending(true);
    setResendError("");
    const answer = await api.auth.resendVerification(unverifiedEmail);
    setResending(false);
    if (!answer.ok) {
      setResendError(`Não foi possível reenviar o e-mail. ${ApiErrorMessage(answer.error)}`);
      return;
    }
    setResent(true);
  }

  async function handleSubmit(data: AuthFormData) {
    setGeneralError("");
    setUnverifiedEmail("");
    setResent(false);
    setResendError("");

    if (isRegister) {
      if (PUBLIC_ORG_ID === null) {
        setGeneralError(MISSING_ORG_MESSAGE);
        return;
      }
      setLoading(true);
      const answer = await api.auth.register({ ...SplitName(data.name), email: data.email, password: data.password }, PUBLIC_ORG_ID);
      setLoading(false);
      if (!answer.ok) {
        setGeneralError(RegisterErrorMessage(answer.error));
        return;
      }
      setUnverifiedEmail(data.email);
      setRegistered(true);
      return;
    }

    setLoading(true);
    const answer = await api.auth.login({ email: data.email, password: data.password });
    if (!answer.ok) {
      setLoading(false);
      if (answer.error.kind === "http" && answer.error.status === 403) setUnverifiedEmail(data.email);
      setGeneralError(LoginErrorMessage(answer.error));
      return;
    }

    const session = StartSession(answer.value.token);
    if (!session.ok) {
      setLoading(false);
      setGeneralError(session.error);
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  if (registered) {
    return (
      <VerifyEmailNotice
        email={unverifiedEmail}
        resending={resending}
        resent={resent}
        error={resendError}
        onResend={() => void handleResend()}
      />
    );
  }

  return (
    <AuthForm
      mode={mode}
      loading={loading}
      generalError={generalError}
      notice={resent ? "Se o e-mail estiver cadastrado, um novo link de confirmação foi enviado." : notice}
      resendError={resendError}
      redirectPath={redirect}
      onResendVerification={unverifiedEmail !== "" && !resent ? () => void handleResend() : undefined}
      resending={resending}
      onSubmit={handleSubmit}
    />
  );
}
