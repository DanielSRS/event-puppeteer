/**
 * Devices that connected without naming an organization (Superadmin queue):
 * one glass card per device, with a warning tile, when it connected, its
 * identifier, and buttons to reject it or assign it to an organization
 * (approving it). With no orphans, a centered empty state.
 *
 * @module
 */

import { MdCheck, MdMonitor } from "react-icons/md";
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
      <div className="glass column items-center gap-2 rounded-[26px] px-6 py-14 text-center">
        <span aria-hidden className="c-ok grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--ok-bg)]">
          <MdCheck className="h-[26px] w-[26px]" />
        </span>
        <h2 className="h2 mt-2">Nenhum dispositivo órfão</h2>
        <p className="t2">Todos os dispositivos conectados já pertencem a uma organização.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="orphans-title" className="column gap-3.5">
      <h2 id="orphans-title" className="sr-only">Aguardando organização ({devices.length})</h2>
      <ul className="column gap-3.5">
        {devices.map((device) => {
          const identifier = DeviceIdentifierText(device);
          const busy = busyDeviceId === device.id;
          return (
            <li key={device.id} className="glass flex flex-wrap items-center gap-3.5 rounded-[26px] p-5">
              <span aria-hidden className="c-warn grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[var(--warn-bg)]">
                <MdMonitor className="h-[22px] w-[22px]" />
              </span>
              <div className="column min-w-0 flex-[1_1_180px] leading-[1.3]">
                <p className="font-semibold">Conectou em {FormatInstant(device.connectedAt)}</p>
                <div className="mono t3 flex flex-wrap gap-x-1 text-[12.5px]">
                  <span>Identificador:</span>
                  <h3 className="break-all">{identifier}</h3>
                </div>
              </div>
              <div className="flex gap-2 max-sm:w-full">
                <button type="button" disabled={busy} onClick={() => onReject(device)} className="button danger-soft flex-1">
                  Rejeitar<span className="sr-only"> {identifier}</span>
                </button>
                <button type="button" disabled={busy} onClick={() => onAssign(device)} className="button flex-[2] font-semibold">
                  Atribuir a uma organização<span className="sr-only"> ({identifier})</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
