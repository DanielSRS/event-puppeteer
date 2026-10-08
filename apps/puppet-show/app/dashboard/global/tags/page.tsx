/**
 * System tags page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalTagsContainer } from "@/components/dashboard/global/tags/GlobalTagsContainer";

export const metadata: Metadata = { title: "Tags Globais - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Tags Globais</h1>
        <p className="mt-1 text-sm text-foreground/70">Tags oficiais, usadas como filtro público em todas as organizações.</p>
      </header>

      <GlobalTagsContainer />
    </div>
  );
}
