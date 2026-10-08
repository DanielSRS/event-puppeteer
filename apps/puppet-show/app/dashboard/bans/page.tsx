/**
 * Shadow-banned users page (Moderator+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardBansContainer } from "@/components/dashboard/bans/DashboardBansContainer";

export const metadata: Metadata = { title: "Usuários Banidos - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Usuários Banidos</h1>
        <p className="mt-1 text-sm text-foreground/70">Pessoas em shadow ban: os eventos que publicam não aparecem no mural até o banimento ser removido.</p>
      </header>

      <DashboardBansContainer />
    </div>
  );
}
