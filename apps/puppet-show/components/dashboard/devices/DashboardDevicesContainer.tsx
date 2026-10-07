'use client';

import React, { useState, useEffect } from 'react';
import { DeviceList, Device } from './DeviceList';

const MOCK_DEVICES: Device[] = [
  {
    id: 'd-1',
    macAddress: 'DC:A6:32:00:11:22',
    status: 'pending',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'd-2',
    macAddress: 'DC:A6:32:44:55:66',
    name: 'Kiosk MT-01',
    location: 'Módulo 1 - Térreo',
    status: 'active',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'd-3',
    macAddress: 'DC:A6:32:77:88:99',
    name: 'Kiosk Bib-01',
    location: 'Biblioteca - Entrada',
    status: 'offline',
    lastSeen: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  }
];

export function DashboardDevicesContainer() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDevices(MOCK_DEVICES);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleApproveDevice = (deviceId: string, name: string, location: string) => {
    setDevices(prev => prev.map(d => 
      d.id === deviceId 
        ? { ...d, status: 'active', name, location } 
        : d
    ));
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando dispositivos...</div>;
  }

  return (
    <DeviceList 
      devices={devices}
      onApproveDevice={handleApproveDevice}
    />
  );
}
