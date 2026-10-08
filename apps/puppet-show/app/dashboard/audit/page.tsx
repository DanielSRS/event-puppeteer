/**
 * Audit trail page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardAuditContainer } from "@/components/dashboard/audit/DashboardAuditContainer";

export const metadata: Metadata = { title: "Auditoria - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Auditoria</h1>
        <p className="mt-1 text-sm text-foreground/70">Todas as ações de moderação e administração desta organização, incluindo as automáticas.</p>
      </header>

      <DashboardAuditContainer />
    </div>
  );
}
