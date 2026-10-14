/**
 * Shadow-banned users page (Moderator+).
 *
 * The header (with the "Moderação" badge) is drawn here, so the `<h1>` is
 * there in every state of the client container.
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardBansContainer } from "@/components/dashboard/bans/DashboardBansContainer";

export const metadata: Metadata = { title: "Usuários Banidos - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        badge={{ label: "Moderação", tone: "bad" }}
        title="Usuários Banidos"
        description="Pessoas em shadow ban nesta organização."
      />

      <DashboardBansContainer />
    </div>
  );
}
