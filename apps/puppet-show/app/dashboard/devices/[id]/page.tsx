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

/** Heading and back link; the client container does the rest. */
export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="column gap-6">
      <header className="column gap-2">
        <Link href="/dashboard/devices" className="row gap-1 self-start min-h-10 text-sm text-foreground/80 hover:text-foreground">
          <MdArrowBack aria-hidden className="icon" /> Voltar para Dispositivos
        </Link>
        <h1 className="title">Dispositivo</h1>
        <p className="text-sm text-foreground/70">Acompanhe o estado do dispositivo e envie comandos remotos.</p>
      </header>

      <DeviceTelemetryContainer deviceId={id} />
    </div>
  );
}
