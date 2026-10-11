/**
 * Saves the new password chosen on the page the reset email links to
 * (`/redefinir-senha?token=…`), then sends the person to the login page.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { ResetPasswordForm } from "../ResetPasswordForm";

/** Reads the token from the URL and submits the new password with it. */
export function ResetPasswordContainer() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);

  const handleSubmit = async (password: string) => {
    if (token === null || token === "") return;
    setSaving(true);
    setError("");
    const answer = await api.auth.resetPassword(token, password);
    setSaving(false);

    if (answer.ok) {
      router.push("/entrar?senhaRedefinida=1");
      return;
    }
    if (answer.error.kind === "http" && answer.error.status === 400) {
      setLinkExpired(true);
      return;
    }
    setError(`Não foi possível salvar a nova senha. ${ApiErrorMessage(answer.error)}`);
  };

  return (
    <ResetPasswordForm
      hasToken={token !== null && token !== ""}
      saving={saving}
      error={error}
      linkExpired={linkExpired}
      onSubmit={(password) => void handleSubmit(password)}
    />
  );
}
