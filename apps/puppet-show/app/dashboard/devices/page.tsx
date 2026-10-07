import React from 'react';
import { DashboardDevicesContainer } from '@/components/dashboard/devices/DashboardDevicesContainer';

export const metadata = {
  title: 'Diretório de Dispositivos - Dashboard',
};

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dispositivos Kiosk</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie e aprove os displays Smart TV ou Raspberry Pi conectados à sua organização.
        </p>
      </div>

      <DashboardDevicesContainer />
    </div>
  );
}
