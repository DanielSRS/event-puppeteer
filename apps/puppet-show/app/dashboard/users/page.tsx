/**
 * Organization users page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardUsersContainer } from "@/components/dashboard/users/DashboardUsersContainer";

export const metadata: Metadata = { title: "Usuários - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        title="Usuários"
        description="Pessoas da organização. O papel define o que cada uma vê no Painel: Membro publica eventos, Moderador cuida da moderação e Admin administra a organização."
      />

      <DashboardUsersContainer />
    </div>
  );
}
