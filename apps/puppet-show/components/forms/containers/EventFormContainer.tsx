/* components/forms/containers/EventFormContainer.tsx */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventForm } from "../EventForm";
import type { EventFormData } from "@/utils/validation/EventValidation";

export function EventFormContainer() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  async function handleSubmit(data: EventFormData) {
    setGeneralError("");
    setLoading(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setGeneralError(responseData.error || "Não foi possível publicar o evento.");
        return;
      };

      router.push("/");
      router.refresh();
    } catch {
      setGeneralError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    };
  };

  return (
    <EventForm
      loading={loading}
      generalError={generalError}
      onSubmit={handleSubmit}
    />
  );
}
