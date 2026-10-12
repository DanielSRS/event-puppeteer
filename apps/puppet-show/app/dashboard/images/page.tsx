/**
 * Image Review page of an organization (Moderator+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardImagesContainer } from "@/components/dashboard/images/DashboardImagesContainer";

export const metadata: Metadata = { title: "Imagens em Revisão - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Imagens em Revisão</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Banners e logos sobre os quais a análise automática teve dúvida. Até serem aprovados, os outros veem só uma prévia borrada.
          Rejeitar coloca quem enviou em shadow ban.
        </p>
      </header>

      <DashboardImagesContainer />
    </div>
  );
}
