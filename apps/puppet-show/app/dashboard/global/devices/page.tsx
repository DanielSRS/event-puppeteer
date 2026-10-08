/**
 * Orphan devices page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalDevicesContainer } from "@/components/dashboard/global/devices/GlobalDevicesContainer";

export const metadata: Metadata = { title: "Dispositivos Órfãos - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-6">
      <header>
        <h1 className="title">Dispositivos Órfãos</h1>
        <p className="mt-1 text-sm text-foreground/70">Dispositivos que se conectaram sem informar uma organização. Atribua cada um a uma organização ou rejeite.</p>
      </header>

      <GlobalDevicesContainer />
    </div>
  );
}
