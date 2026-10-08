/**
 * Devices that connected without naming an organization (Superadmin queue):
 * each can be assigned to an organization (approving it) or rejected.
 *
 * @module
 */

import { MdClose, MdMonitor, MdOutlineLink } from "react-icons/md";
import type { Device } from "@/lib/api/schemas";
import { FormatInstant } from "../../audit/instant";
import { DeviceIdentifierText } from "../../devices/telemetryFormat";

export type OrphanDeviceListProps = {
  devices: Device[];
  /** Device being handled right now. */
  busyDeviceId: string | null;
  onAssign: (device: Device) => void;
  onReject: (device: Device) => void;
};

/** The orphan devices, or an empty state. */
export function OrphanDeviceList({ devices, busyDeviceId, onAssign, onReject }: OrphanDeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="column items-center gap-2 rounded-lg border border-dashed border-muted p-8 text-center">
        <MdMonitor aria-hidden className="w-12 h-12 text-foreground/50" />
        <h2 className="text-lg font-medium">Nenhum dispositivo órfão</h2>
        <p className="text-sm text-foreground/70">Todos os dispositivos conectados já pertencem a uma organização.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="orphans-title" className="column gap-3">
      <h2 id="orphans-title" className="subtitle">Aguardando organização ({devices.length})</h2>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {devices.map((device) => {
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
                <button type="button" disabled={busy} onClick={() => onAssign(device)} className="button main min-h-10">
                  <MdOutlineLink aria-hidden className="icon" /> Atribuir a uma organização<span className="sr-only"> ({identifier})</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
