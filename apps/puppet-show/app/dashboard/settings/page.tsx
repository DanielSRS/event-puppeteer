/**
 * Organization settings page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardSettingsContainer } from "@/components/dashboard/settings/DashboardSettingsContainer";

export const metadata: Metadata = { title: "Configurações - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Configurações</h1>
        <p className="mt-1 text-sm text-foreground/70">Perfil da organização e limite de denúncias para ocultar eventos automaticamente.</p>
      </header>

      <DashboardSettingsContainer />
    </div>
  );
}
