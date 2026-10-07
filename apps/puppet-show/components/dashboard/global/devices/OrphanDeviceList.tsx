import React from 'react';
import { MdMonitor, MdOutlineLink } from 'react-icons/md';

export interface OrphanDevice {
  id: string;
  identifier: string;
  firstSeen: string;
  ipAddress?: string;
}

interface OrphanDeviceListProps {
  devices: OrphanDevice[];
  onAssignToOrg: (deviceId: string) => void;
}

export function OrphanDeviceList({ devices, onAssignToOrg }: OrphanDeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-background rounded-lg border border-dashed border-muted">
        <MdMonitor className="w-12 h-12 text-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Nenhum dispositivo órfão</h3>
        <p className="mt-1 text-sm text-foreground/60">
          Todos os totens conectados já estão vinculados a alguma organização.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-surface shadow-sm ring-1 ring-muted sm:rounded-lg">
      <table className="min-w-full divide-y divide-muted">
        <thead className="bg-background">
          <tr>
            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground">Identificador</th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Endereço IP</th>
            <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Primeira Conexão</th>
            <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted bg-surface">
          {devices.map(device => (
            <tr key={device.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-mono font-medium text-foreground">
                {device.identifier}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60 font-mono">
                {device.ipAddress ?? '-'}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                {new Date(device.firstSeen).toLocaleString()}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button
                  onClick={() => onAssignToOrg(device.id)}
                  className="text-main hover:text-main inline-flex items-center gap-1"
                >
                  <MdOutlineLink className="w-4 h-4" />
                  Atribuir a Org
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
