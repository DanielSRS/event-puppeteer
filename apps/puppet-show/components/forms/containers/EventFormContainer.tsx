/* components/forms/containers/EventFormContainer.tsx */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventForm } from "../EventForm";
import type { EventFormData } from "@/utils/validation/EventValidation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { ToCreateEventInput } from "@/lib/api/mappers";
import { UserOrgId } from "@/lib/api/types";

export function EventFormContainer() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  async function handleSubmit(data: EventFormData) {
    setGeneralError("");

    if (!user) {
      router.push("/entrar?redirect=/eventos/novo");
      return;
    };

    /* EVENTS BELONG TO AN ORGANIZATION; A SUPERADMIN HAS NONE OF THEIR OWN */
    const orgId = UserOrgId(user);

    if (!orgId) {
      setGeneralError("Superadmins publicam eventos pelo painel, escolhendo a organização.");
      return;
    };

    setLoading(true);

    try {
      await api.events.create(orgId, ToCreateEventInput(data));

      router.push("/");
      router.refresh();
    } catch {
      setGeneralError("Não foi possível publicar o evento.");
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
