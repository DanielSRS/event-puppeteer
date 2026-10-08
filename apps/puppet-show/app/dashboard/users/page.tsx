/**
 * Organization users page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardUsersContainer } from "@/components/dashboard/users/DashboardUsersContainer";

export const metadata: Metadata = { title: "Usuários - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Usuários</h1>
        <p className="mt-1 text-sm text-foreground/70">Pessoas da organização: busque, altere papéis e remova contas.</p>
      </header>

      <DashboardUsersContainer />
    </div>
  );
}
