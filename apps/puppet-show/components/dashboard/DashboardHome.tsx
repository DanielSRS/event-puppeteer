/**
 * `/dashboard` itself has no content: it opens the first section the person
 * can access in the current context (and follows the context when it changes).
 *
 * @module
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingMessage } from "@/components/ui/Feedback";
import { useDashboard } from "./DashboardContext";
import { AccessibleSections } from "./DashboardSections";

/** Redirects to the first accessible section. */
export function DashboardHome() {
  const router = useRouter();
  const { user, orgId } = useDashboard();
  const first = AccessibleSections(user, orgId).at(0);
  const target = first === undefined ? null : first.href;

  useEffect(() => {
    if (target !== null) router.replace(target);
  }, [target, router]);

  if (first === undefined)
    return <p className="card">Não há nenhuma seção do painel disponível para você neste contexto.</p>;

  return <LoadingMessage>Abrindo {first.label}...</LoadingMessage>;
}
