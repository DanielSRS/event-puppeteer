/**
 * Device page (Admin+): status, telemetry, commands and logs of one device.
 *
 * @module
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import { DeviceTelemetryContainer } from "@/components/dashboard/devices/DeviceTelemetryContainer";

export const metadata: Metadata = { title: "Dispositivo - Painel" };

/**
 * Back link and the page's `<h1>` (a small caption above the device name,
 * which the client container draws with the rest).
 */
export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="column gap-2.5">
      <div className="column items-start gap-1">
        <Link href="/dashboard/devices" className="t2 focus-ring row -ml-1 min-h-11 gap-2 rounded-xl px-1 font-medium hover:text-foreground">
          <MdArrowBack aria-hidden className="h-[18px] w-[18px]" /><span><span className="sr-only">Voltar para </span>Dispositivos</span>
        </Link>
        <h1 className="caption">Dispositivo</h1>
      </div>

      <DeviceTelemetryContainer deviceId={id} />
    </div>
  );
}
