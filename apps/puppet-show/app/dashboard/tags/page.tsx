/**
 * Suggested (free-form) tags page (Moderator+).
 *
 * The header (with the "Moderação" badge) is drawn here, so the `<h1>` is
 * there in every state of the client container.
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardTagsContainer } from "@/components/dashboard/tags/DashboardTagsContainer";

export const metadata: Metadata = { title: "Tags Sugeridas - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        badge={{ label: "Moderação", tone: "bad" }}
        title="Tags Sugeridas"
        description="Quem publica um evento pode criar tags livres. Elas ficam ocultas no mural até você promovê-las a tags oficiais, que viram filtros para todos."
      />

      <DashboardTagsContainer />
    </div>
  );
}
