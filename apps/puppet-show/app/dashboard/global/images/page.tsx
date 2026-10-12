/**
 * Escalated Image Review page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalImagesContainer } from "@/components/dashboard/global/images/GlobalImagesContainer";

export const metadata: Metadata = { title: "Imagens Escalonadas - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Imagens Escalonadas</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Imagens que só superadmins podem revisar: enviadas por superadmins ou de organizações sem outro moderador ou administrador.
        </p>
      </header>

      <GlobalImagesContainer />
    </div>
  );
}
