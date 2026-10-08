/**
 * Link labels page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalLinksContainer } from "@/components/dashboard/global/links/GlobalLinksContainer";

export const metadata: Metadata = { title: "Rótulos de Links - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Rótulos de Links</h1>
        <p className="mt-1 text-sm text-foreground/70">Nomes que os links dos eventos podem ter (por exemplo, “Inscrição”).</p>
      </header>

      <GlobalLinksContainer />
    </div>
  );
}
