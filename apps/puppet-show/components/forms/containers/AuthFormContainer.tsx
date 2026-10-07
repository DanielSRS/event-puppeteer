/* components/forms/containers/AuthFormContainer.tsx */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm, AuthFormData } from "../AuthForm";
import { NotifyAuthChange } from "@/hooks/useAuth";

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
      const response = await fetch(isRegister ? "/api/users/register" : "/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(isRegister ? data : { email: data.email, password: data.password }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setGeneralError(responseData.error || "Não foi possível continuar.");
        return;
      };

      NotifyAuthChange();
      router.push(redirect);
      router.refresh();
    } catch {
      setGeneralError("Erro de conexão com o servidor.");
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
