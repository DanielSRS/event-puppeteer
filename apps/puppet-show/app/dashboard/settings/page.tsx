/**
 * Organization settings page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardSettingsContainer } from "@/components/dashboard/settings/DashboardSettingsContainer";

export const metadata: Metadata = { title: "Configurações - Painel" };

/** The client container draws the header (it names the organization) and the settings. */
export default function Page() {
  return <DashboardSettingsContainer />;
}
