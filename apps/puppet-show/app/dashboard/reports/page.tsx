/**
 * Moderation queue page (Moderator+).
 *
 * The header (with the "Moderação" badge) is drawn here, so the `<h1>` is
 * there in every state of the client container.
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardReportsContainer } from "@/components/dashboard/reports/DashboardReportsContainer";

export const metadata: Metadata = { title: "Denúncias - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        badge={{ label: "Moderação", tone: "bad" }}
        title="Denúncias"
        description="Eventos denunciados nesta organização, os mais denunciados primeiro. A denúncia fica registrada mesmo depois da sua decisão — aqui você só decide se o evento aparece ou não."
      />

      <DashboardReportsContainer />
    </div>
  );
}
