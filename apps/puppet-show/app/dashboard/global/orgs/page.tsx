/**
 * Organizations page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalOrgsContainer } from "@/components/dashboard/global/orgs/GlobalOrgsContainer";

export const metadata: Metadata = { title: "Organizações - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Organizações</h1>
        <p className="mt-1 text-sm text-foreground/70">Todas as organizações da plataforma. Crie novas e edite as existentes.</p>
      </header>

      <GlobalOrgsContainer />
    </div>
  );
}
