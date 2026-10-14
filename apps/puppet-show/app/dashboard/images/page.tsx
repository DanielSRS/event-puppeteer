/**
 * Image Review page of an organization (Moderator+).
 *
 * The header (with the "Moderação" badge) is drawn here, so the `<h1>` is
 * there in every state of the client container.
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardImagesContainer } from "@/components/dashboard/images/DashboardImagesContainer";

export const metadata: Metadata = { title: "Imagens em Revisão - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        badge={{ label: "Moderação", tone: "bad" }}
        title="Imagens em Revisão"
        description="Banners e logos sobre os quais a análise automática teve dúvida. Cada imagem fica borrada até você revelá-la, sabendo antes o que foi suspeitado. Suas próprias imagens nunca aparecem aqui."
      />

      <DashboardImagesContainer />
    </div>
  );
}
