/**
 * Suggested (free-form) tags page (Moderator+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardTagsContainer } from "@/components/dashboard/tags/DashboardTagsContainer";

export const metadata: Metadata = { title: "Tags Sugeridas - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Tags Sugeridas</h1>
        <p className="mt-1 text-sm text-foreground/70">Tags livres criadas pelas pessoas aguardam revisão. Promova as que devem virar filtro público.</p>
      </header>

      <DashboardTagsContainer />
    </div>
  );
}
