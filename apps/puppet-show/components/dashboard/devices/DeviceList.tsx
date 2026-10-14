/**
 * Devices of an organization: those waiting for approval, in amber-edged
 * cards with "Rejeitar" and "Aprovar" (the form opens in a side panel), and
 * the active ones in a grid of cards with their online badge, place, last
 * heartbeat, identifier and a link to the device page.
 *
 * @module
 */

import Link from "next/link";
import { MdArrowForward } from "react-icons/md";
import type { Device, DeviceStatus } from "@/lib/api/schemas";
import type { Result } from "@/lib/result";
import { FormatInstant } from "../audit/instant";
import { DeviceDisplayName, DeviceIdentifierText } from "./telemetryFormat";
import { DeviceGlyph } from "./device-glyph";

/** An active device with its online status (or why it couldn't be read). */
export type ActiveDevice = { device: Device; status: Result<DeviceStatus, string> };

export type DeviceListProps = {
  pending: Device[];
  active: ActiveDevice[];
  /** Device being approved or rejected right now. */
  busyDeviceId: string | null;
  onApprove: (device: Device) => void;
  onReject: (device: Device) => void;
};

/** Online/offline badge (colour, dot and text). */
export function OnlineBadge({ status, className = "" }: { status: DeviceStatus; className?: string }) {
  return (
    <span className={`badge ${status.isOnline ? "b-ok" : "b-bad"} ${className}`}>
      {status.isOnline ? "Online" : "Offline"}
    </span>
  );
}

/** Text of the last heartbeat. */
export function LastHeartbeatText(status: DeviceStatus): string {
  return status.latestHeartbeat === null ? "Nenhum sinal recebido ainda" : `Último sinal: ${FormatInstant(status.latestHeartbeat.timestamp)}`;
}

/** `"3 online · 1 offline"`, counting only the devices whose status could be read. */
function OnlineSummary(active: ActiveDevice[]): string {
  const known = active.flatMap(({ status }) => status.ok ? [status.value] : []);
  const online = known.filter((status) => status.isOnline).length;
  return `${online} online · ${known.length - online} offline`;
}

/** Empty state of a section. */
function EmptyNote({ children }: { children: string }) {
  return <p className="glass t2 rounded-[24px] border-dashed p-6 text-center text-sm">{children}</p>;
}

/** Pending and active devices. */
export function DeviceList({ pending, active, busyDeviceId, onApprove, onReject }: DeviceListProps) {
  return (
    <div className="column gap-[22px]">
      <section aria-labelledby="pending-devices-title" className="column gap-3">
        <h2 id="pending-devices-title" className="h2 row gap-2.5">
          Aguardando aprovação
          {pending.length > 0 && <span aria-hidden className="count count-warn font-sans">{pending.length}</span>}
          <span className="sr-only">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <EmptyNote>Nenhum dispositivo aguardando aprovação.</EmptyNote>
        ) : (
          <ul className="column gap-3">
            {pending.map((device) => {
              const identifier = DeviceIdentifierText(device);
              const busy = busyDeviceId === device.id;
              return (
                <li
                  key={device.id}
                  className="glass flex flex-wrap items-center gap-4 rounded-[26px] p-5"
                  style={{ borderColor: "color-mix(in oklab, var(--warn) 35%, transparent)" }}
                >
                  <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
                    <span aria-hidden className="c-warn grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--warn-bg)]">
                      <DeviceGlyph size={22} />
                    </span>
                    <div className="column min-w-0 leading-snug">
                      <h3 className="font-semibold">Novo totem conectado<span className="sr-only"> ({identifier})</span></h3>
                      <p className="mono t3 text-[12.5px] break-all">Identificador: {identifier}</p>
                      <p className="t3 text-[12.5px]">Conectou em {FormatInstant(device.connectedAt)}</p>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button type="button" disabled={busy} onClick={() => onReject(device)} className="button danger-soft focus-ring min-h-12 flex-1 sm:flex-none">
                      Rejeitar<span className="sr-only"> {identifier}</span>
                    </button>
                    <button type="button" disabled={busy} onClick={() => onApprove(device)} className="button main focus-ring min-h-12 flex-[2] px-6 sm:flex-none">
                      Aprovar<span className="sr-only"> {identifier}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-devices-title" className="column gap-3">
        <h2 id="active-devices-title" className="h2 flex flex-wrap items-baseline gap-x-2.5">
          Ativos
          {active.length > 0 && <span className="mono t3 text-[13px] font-normal tracking-normal">{OnlineSummary(active)}</span>}
        </h2>
        {active.length === 0 ? (
          <EmptyNote>Nenhum dispositivo ativo.</EmptyNote>
        ) : (
          <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))]">
            {active.map(({ device, status }) => {
              const name = DeviceDisplayName(device);
              return (
                <li key={device.id} className="glass lift column gap-3.5 rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-2.5">
                    <span aria-hidden className="surface-2 grid h-11 w-11 place-items-center rounded-[14px]">
                      <DeviceGlyph />
                    </span>
                    {status.ok && <OnlineBadge status={status.value} />}
                  </div>
                  <div className="column min-w-0 gap-0.5">
                    <h3 className="h2 text-[19px] break-words">{name}</h3>
                    <p className={`break-words ${device.location === undefined ? "t3" : "t2"}`}>
                      {device.location === undefined ? "Local não informado" : device.location}
                    </p>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    <dt className="t3">Sinal</dt>
                    <dd className={status.ok ? "" : "text-danger"}>{status.ok ? LastHeartbeatText(status.value) : status.error}</dd>
                    <dt className="t3">Identificador</dt>
                    <dd className="mono break-all">{DeviceIdentifierText(device)}</dd>
                  </dl>
                  <Link href={`/dashboard/devices/${device.id}`} className="button focus-ring mt-auto">
                    Ver detalhes<span className="sr-only"> de {name}</span>
                    <MdArrowForward aria-hidden className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
