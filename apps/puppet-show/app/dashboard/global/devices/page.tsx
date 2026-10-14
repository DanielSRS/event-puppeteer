/**
 * Orphan devices page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalDevicesContainer } from "@/components/dashboard/global/devices/GlobalDevicesContainer";

export const metadata: Metadata = { title: "Dispositivos Órfãos - Painel" };

/** The client container draws the header (with the "Sistema Global" badge) and the content. */
export default function Page() {
  return <GlobalDevicesContainer />;
}
