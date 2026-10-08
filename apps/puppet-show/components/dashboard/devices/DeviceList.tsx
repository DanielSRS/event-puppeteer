/**
 * Devices of an organization: those waiting for approval (approve or reject)
 * and the active ones with their online status, last heartbeat and identifier.
 *
 * @module
 */

import Link from "next/link";
import { MdAccessTime, MdCheck, MdClose, MdMonitor } from "react-icons/md";
import type { Device, DeviceStatus } from "@/lib/api/schemas";
import type { Result } from "@/lib/result";
import { FormatInstant } from "../audit/instant";
import { DeviceDisplayName, DeviceIdentifierText } from "./telemetryFormat";

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

/** Online/offline badge with the last heartbeat. */
export function OnlineBadge({ status }: { status: DeviceStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${status.isOnline ? "bg-success/10 text-success ring-success/30" : "bg-danger/10 text-danger ring-danger/30"}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.isOnline ? "bg-success" : "bg-danger"}`} />
      {status.isOnline ? "Online" : "Offline"}
    </span>
  );
}

/** Text of the last heartbeat. */
export function LastHeartbeatText(status: DeviceStatus): string {
  return status.latestHeartbeat === null ? "Nenhum sinal recebido ainda" : `Último sinal: ${FormatInstant(status.latestHeartbeat.timestamp)}`;
}

/** Pending and active devices. */
export function DeviceList({ pending, active, busyDeviceId, onApprove, onReject }: DeviceListProps) {
  return (
    <div className="column gap-8">
      <section aria-labelledby="pending-devices-title" className="column gap-3">
        <h2 id="pending-devices-title" className="subtitle row gap-2">
          <MdAccessTime aria-hidden className="icon text-main" /> Aguardando aprovação ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-muted p-6 text-center text-sm text-foreground/70">Nenhum dispositivo aguardando aprovação.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pending.map((device) => {
              const identifier = DeviceIdentifierText(device);
              const busy = busyDeviceId === device.id;
              return (
                <li key={device.id} className="card column gap-3">
                  <div>
                    <h3 className="font-mono text-sm font-medium break-all">{identifier}</h3>
                    <p className="text-xs text-foreground/70">Conectou em {FormatInstant(device.connectedAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button type="button" disabled={busy} onClick={() => onReject(device)} className="button clean min-h-10 text-danger">
                      <MdClose aria-hidden className="icon" /> Rejeitar<span className="sr-only"> {identifier}</span>
                    </button>
                    <button type="button" disabled={busy} onClick={() => onApprove(device)} className="button main min-h-10">
                      <MdCheck aria-hidden className="icon" /> Aprovar<span className="sr-only"> {identifier}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="active-devices-title" className="column gap-3">
        <h2 id="active-devices-title" className="subtitle row gap-2">
          <MdMonitor aria-hidden className="icon text-main" /> Dispositivos ativos ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-muted p-6 text-center text-sm text-foreground/70">Nenhum dispositivo ativo.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {active.map(({ device, status }) => {
              const name = DeviceDisplayName(device);
              return (
                <li key={device.id} className="card column gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium break-words">{name}</h3>
                      <p className="text-sm text-foreground/70 break-words">{device.location === undefined ? "Local não informado" : device.location}</p>
                    </div>
                    {status.ok && <OnlineBadge status={status.value} />}
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-foreground/70">Identificador</dt>
                    <dd className="font-mono break-all">{DeviceIdentifierText(device)}</dd>
                    <dt className="text-foreground/70">Sinal</dt>
                    <dd className={status.ok ? "" : "text-danger"}>{status.ok ? LastHeartbeatText(status.value) : status.error}</dd>
                  </dl>
                  <Link href={`/dashboard/devices/${device.id}`} className="button clean min-h-10 self-start">
                    Ver detalhes<span className="sr-only"> de {name}</span>
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
