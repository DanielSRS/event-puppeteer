/**
 * Organization devices page (Admin+).
 *
 * @module
 */

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardDevicesContainer } from "@/components/dashboard/devices/DashboardDevicesContainer";

export const metadata: Metadata = { title: "Dispositivos - Painel" };

/** Heading and description; the client container does the rest. */
export default function Page() {
  return (
    <div className="column gap-[22px]">
      <PageHeader
        title="Dispositivos"
        description="Os totens da organização que exibem o mural. Um totem novo só começa a exibir depois de aprovado, com nome e local."
      />

      <DashboardDevicesContainer />
    </div>
  );
}
