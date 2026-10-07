import React from 'react';
import { GlobalDevicesContainer } from '@/components/dashboard/global/devices/GlobalDevicesContainer';

export const metadata = {
  title: 'Dispositivos Órfãos - Superadmin',
};

export default function GlobalDevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="title">Dispositivos Órfãos</h1>
        <p className="mt-1 text-sm opacity-60">
          Totens que conectaram no sistema mas ainda não foram atribuídos a nenhuma organização.
        </p>
      </div>

      <GlobalDevicesContainer />
    </div>
  );
}
