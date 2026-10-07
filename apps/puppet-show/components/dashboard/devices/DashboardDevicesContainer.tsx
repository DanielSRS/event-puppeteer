'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { DeviceList, Device } from './DeviceList';
import { api } from '@/lib/api/client';
import type { Device as ApiDevice } from '@/lib/api/types';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

function ToListDevice(device: ApiDevice): Device {
  return {
    id: device.id,
    identifier: device.id,
    name: device.name,
    location: device.location,
    status: device.status === 'pending' ? 'pending' : device.status === 'active' ? 'active' : 'offline',
    connectedAt: device.connectedAt,
  };
}

export function DashboardDevicesContainer() {
  const { orgId } = useDashboard();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!orgId) return;
    Promise.all([api.devices.listOrgPending(orgId), api.devices.listActive(orgId)])
      .then(([pending, active]) => {
        setDevices([...pending, ...active].map(ToListDevice));
        setError('');
      })
      .catch(() => setError('Erro ao carregar dispositivos.'))
      .finally(() => setLoadedOrgId(orgId));
  }, [orgId]);

  const handleApproveDevice = (deviceId: string, name: string, location: string) => {
    startTransition(async () => {
      try {
        const device = await api.devices.approve(deviceId, { name, location });
        setDevices(prev => prev.map(d => d.id === deviceId ? ToListDevice(device) : d));
      } catch {
        setError('Não foi possível aprovar o dispositivo.');
      }
    });
  };

  if (!orgId) return <SelectOrgNotice />;

  if (loadedOrgId !== orgId) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando dispositivos...</div>;
  }

  return (
    <div className={isPending ? "opacity-50" : ""}>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <DeviceList 
        devices={devices}
        onApproveDevice={handleApproveDevice}
      />
    </div>
  );
}
