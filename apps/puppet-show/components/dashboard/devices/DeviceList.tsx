import React from 'react';
import { MdMonitor, MdPersonalVideo, MdSettings, MdAccessTime } from 'react-icons/md';
import Link from 'next/link';

export type DeviceStatus = 'pending' | 'active' | 'offline';

export interface Device {
  id: string;
  identifier: string;
  name?: string;
  location?: string;
  status: DeviceStatus;
  connectedAt: string;
}

interface DeviceListProps {
  devices: Device[];
  onApproveDevice: (deviceId: string, name: string, location: string) => void;
}

export function DeviceList({ devices, onApproveDevice }: DeviceListProps) {
  const pendingDevices = devices.filter(d => d.status === 'pending');
  const enrolledDevices = devices.filter(d => d.status !== 'pending');

  const handleApprove = (deviceId: string) => {
    const name = prompt('Nome do Dispositivo (ex: Totem Refeitório):');
    if (!name) return;
    const location = prompt('Localização (ex: Módulo 2):');
    if (!location) return;
    onApproveDevice(deviceId, name, location);
  };

  return (
    <div className="space-y-8">
      {/* Pending Devices */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <MdAccessTime className="w-5 h-5 text-main" /> Aguardando Aprovação ({pendingDevices.length})
        </h3>
        {pendingDevices.length === 0 ? (
          <div className="p-6 bg-background border border-dashed rounded-lg text-center text-foreground/60 border-muted">
            Nenhum novo dispositivo aguardando aprovação.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingDevices.map(device => (
              <div key={device.id} className="p-4 bg-main/10 border border-main/40 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-mono text-sm text-foreground">{device.identifier}</div>
                  <div className="text-xs text-foreground/60 mt-1">Conectado em: {new Date(device.connectedAt).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleApprove(device.id)}
                  className="px-3 py-1.5 bg-main text-background text-sm font-medium rounded hover:opacity-90"
                >
                  Aprovar & Configurar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Enrolled Devices */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <MdMonitor className="w-5 h-5 text-main" /> Dispositivos Ativos ({enrolledDevices.length})
        </h3>
        <div className="overflow-hidden bg-surface shadow-sm ring-1 ring-muted sm:rounded-lg">
          <table className="min-w-full divide-y divide-muted">
            <thead className="bg-background">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground">Nome / Local</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Identificador</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Conectado em</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted bg-surface">
              {enrolledDevices.map(device => (
                <tr key={device.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <MdPersonalVideo className="w-4 h-4 text-foreground/50" />
                      {device.name}
                    </div>
                    <div className="text-foreground/60 text-xs ml-6 mt-0.5">{device.location}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-mono text-foreground/60">
                    {device.identifier}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {device.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success ring-1 ring-inset ring-success/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger ring-1 ring-inset ring-danger/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Offline
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/60">
                    {new Date(device.connectedAt).toLocaleString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link
                      href={`/dashboard/devices/${device.id}`}
                      className="text-main hover:text-main inline-flex items-center gap-1"
                    >
                      <MdSettings className="w-4 h-4" /> Configurar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
