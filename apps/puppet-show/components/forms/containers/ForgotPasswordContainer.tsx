/**
 * Sends the password-reset email for the "Esqueci minha senha" page.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

/** Asks the API for the reset link and shows the result. */
export function ForgotPasswordContainer() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (email: string) => {
    setSending(true);
    setError("");
    const answer = await api.auth.requestPasswordReset(email);
    setSending(false);
    if (!answer.ok) {
      setError(`Não foi possível enviar o link. ${ApiErrorMessage(answer.error)}`);
      return;
    }
    setSent(true);
  };

  return <ForgotPasswordForm sending={sending} sent={sent} error={error} onSubmit={(email) => void handleSubmit(email)} />;
}
