/**
 * Moderation queue page (Moderator+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardReportsContainer } from "@/components/dashboard/reports/DashboardReportsContainer";

export const metadata: Metadata = { title: "Denúncias - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Denúncias</h1>
        <p className="mt-1 text-sm text-foreground/70">Eventos denunciados pelas pessoas, agrupados por evento. Oculte do mural o que não deve aparecer.</p>
      </header>

      <DashboardReportsContainer />
    </div>
  );
}
