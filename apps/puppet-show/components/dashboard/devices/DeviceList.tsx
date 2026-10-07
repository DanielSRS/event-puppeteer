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
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <MdAccessTime className="w-5 h-5 text-yellow-600" /> Aguardando Aprovação ({pendingDevices.length})
        </h3>
        {pendingDevices.length === 0 ? (
          <div className="p-6 bg-gray-50 border border-dashed rounded-lg text-center text-gray-500">
            Nenhum novo dispositivo aguardando aprovação.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingDevices.map(device => (
              <div key={device.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-mono text-sm text-gray-800">{device.identifier}</div>
                  <div className="text-xs text-gray-500 mt-1">Conectado em: {new Date(device.connectedAt).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleApprove(device.id)}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700"
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
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <MdMonitor className="w-5 h-5 text-blue-600" /> Dispositivos Ativos ({enrolledDevices.length})
        </h3>
        <div className="overflow-hidden bg-white shadow-sm ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Nome / Local</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Identificador</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Conectado em</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {enrolledDevices.map(device => (
                <tr key={device.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      <MdPersonalVideo className="w-4 h-4 text-gray-400" />
                      {device.name}
                    </div>
                    <div className="text-gray-500 text-xs ml-6 mt-0.5">{device.location}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-mono text-gray-500">
                    {device.identifier}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {device.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Offline
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {new Date(device.connectedAt).toLocaleString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <Link
                      href={`/dashboard/devices/${device.id}`}
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
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
