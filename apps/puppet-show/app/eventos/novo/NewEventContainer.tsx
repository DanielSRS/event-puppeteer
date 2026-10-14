/**
 * The `/eventos/novo` screen: checks the session, then shows the event editor
 * for the person's own organization.
 *
 * Anonymous visitors go to the login page and come back here. A Superadmin has
 * no organization of their own, so they are pointed to the dashboard, where
 * events are created inside the selected organization.
 *
 * The editor sits on a glass card; its bottom bar (Voltar / Avançar) sticks to
 * the bottom of the window while the step scrolls.
 *
 * @module
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventFormContainer } from "@/components/forms/containers/EventFormContainer";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";

/** Where anonymous visitors are sent. */
const LOGIN_URL = `/entrar?redirect=${encodeURIComponent("/eventos/novo")}`;

/** Session-aware wrapper around the event editor. */
export function NewEventContainer() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === "anonymous") router.replace(LOGIN_URL);
  }, [state.status, router]);

  if (state.status === "loading") return <LoadingMessage>Verificando sua sessão...</LoadingMessage>;
  if (state.status === "error") return <ErrorAlert>{state.message}</ErrorAlert>;
  if (state.status === "anonymous") return <LoadingMessage>Redirecionando para o login...</LoadingMessage>;

  const { user } = state;

  if (user.role === "Superadmin") {
    return (
      <div className="glass-strong column gap-4 rounded-[28px] p-5 sm:p-6">
        <p className="t2">
          Superadmins não pertencem a uma organização, então publicam eventos pelo painel, dentro da organização
          selecionada no seletor de contexto.
        </p>
        <Link href="/dashboard/events" className="button main self-start focus-ring">Ir para Meus Eventos no painel</Link>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-[28px] p-5 sm:p-6">
      <EventFormContainer orgId={user.organizationId} onCreated={(event) => router.push(`/eventos/${event.id}`)} />
    </div>
  );
}
