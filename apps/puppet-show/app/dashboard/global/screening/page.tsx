/**
 * Screening Policy page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalScreeningContainer } from "@/components/dashboard/global/screening/GlobalScreeningContainer";

export const metadata: Metadata = { title: "Política de Triagem - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Política de Triagem</h1>
        <p className="mt-1 text-sm text-foreground/70">
          Para cada categoria, a análise automática dá uma nota de 0% a 100%. Abaixo do limite de revisão, a imagem é aprovada;
          a partir dele, aguarda revisão humana; a partir do limite de recusa, é recusada sem que ninguém precise vê-la.
          Vale para todas as organizações.
        </p>
      </header>

      <GlobalScreeningContainer />
    </div>
  );
}
