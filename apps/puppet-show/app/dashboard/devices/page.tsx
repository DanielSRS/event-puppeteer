/**
 * Organization devices page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { DashboardDevicesContainer } from "@/components/dashboard/devices/DashboardDevicesContainer";

export const metadata: Metadata = { title: "Dispositivos - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Dispositivos</h1>
        <p className="mt-1 text-sm text-foreground/70">Totens da organização: aprove novos dispositivos e acompanhe os ativos.</p>
      </header>

      <DashboardDevicesContainer />
    </div>
  );
}
