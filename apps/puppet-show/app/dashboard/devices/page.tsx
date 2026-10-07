import React from 'react';
import { DashboardDevicesContainer } from '@/components/dashboard/devices/DashboardDevicesContainer';

export const metadata = {
  title: 'Diretório de Dispositivos - Dashboard',
};

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Dispositivos Kiosk</h1>
        <p className="mt-1 text-sm opacity-60">
          Gerencie e aprove os displays Smart TV ou Raspberry Pi conectados à sua organização.
        </p>
      </div>

      <DashboardDevicesContainer />
    </div>
  );
}
