/**
 * `/dashboard` itself has no content: it opens the first section the person
 * can access in the current context (and follows the context when it changes).
 * While it redirects it shows a loading line; when no section is available it
 * shows the page header and an empty-state panel.
 *
 * @module
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MdDashboard } from "react-icons/md";
import { LoadingMessage } from "@/components/ui/Feedback";
import { PageHeader } from "./page-header";
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

  if (first === undefined) {
    return (
      <>
        <PageHeader title="Painel" />
        <div className="glass column items-center gap-3 rounded-[26px] px-6 py-10 text-center">
          <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] t2">
            <MdDashboard className="h-6 w-6" />
          </span>
          <p className="t2 max-w-[48ch]">Não há nenhuma seção do painel disponível para você neste contexto.</p>
        </div>
      </>
    );
  }

  return <LoadingMessage className="glass rounded-[26px]">Abrindo {first.label}...</LoadingMessage>;
}
