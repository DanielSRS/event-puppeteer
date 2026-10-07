/* components/forms/containers/AuthFormContainer.tsx */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm, AuthFormData } from "../AuthForm";
import { StartSession } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api/client";
import { DEFAULT_ORG_ID } from "@/lib/api/session";

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

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  async function handleSubmit(data: AuthFormData) {
    setGeneralError("");
    setLoading(true);

    try {
      const { token } = isRegister
        ? await api.auth.register({ ...SplitName(data.name), email: data.email, password: data.password }, DEFAULT_ORG_ID)
        : await api.auth.login({ email: data.email, password: data.password });

      StartSession(token);
      router.push(redirect);
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError))
        setGeneralError("Erro de conexão com o servidor.");
      else if (isRegister)
        setGeneralError(err.status === 400 ? "Este e-mail já está cadastrado ou os dados são inválidos." : "Não foi possível criar a conta.");
      else
        setGeneralError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    };
  };

  return (
    <AuthForm
      mode={mode}
      loading={loading}
      generalError={generalError}
      redirectPath={redirect}
      onSubmit={handleSubmit}
    />
  );
}
