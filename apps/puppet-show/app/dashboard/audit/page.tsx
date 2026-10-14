/**
 * Audit trail page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardAuditContainer } from "@/components/dashboard/audit/DashboardAuditContainer";

export const metadata: Metadata = { title: "Auditoria - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        title="Auditoria"
        description="Toda ação de moderação e administração desta organização, inclusive as automáticas, da mais recente para a mais antiga. O registro não pode ser editado."
      />

      <DashboardAuditContainer />
    </div>
  );
}
