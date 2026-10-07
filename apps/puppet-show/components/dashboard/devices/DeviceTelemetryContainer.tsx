'use client';

import React, { useState, useEffect } from 'react';
import { DeviceTelemetry, DeviceInfo } from './DeviceTelemetry';

interface Props {
  deviceId: string;
}

export function DeviceTelemetryContainer({ deviceId }: Props) {
  const [device, setDevice] = useState<DeviceInfo | null>(null);

  const fetchTelemetry = () => {
    // Simulate API fetch based on deviceId
    setDevice({
      id: deviceId,
      name: 'Kiosk ' + deviceId.slice(0, 4),
      location: 'Prédio Anexo',
      macAddress: 'DC:A6:32:00:11:22',
      telemetry: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 2000),
        temperature: Math.floor(Math.random() * 30) + 40,
        lastPing: new Date().toISOString(),
      }
    });
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [deviceId]);

  const handleReboot = () => {
    if (confirm('Tem certeza que deseja reiniciar o dispositivo?')) {
      alert('Comando de reinicialização enviado.');
    }
  };

  if (!device) return <div className="p-8 text-center text-gray-500 animate-pulse">Conectando ao dispositivo...</div>;

  return (
    <DeviceTelemetry 
      device={device}
      onReboot={handleReboot}
      onRefresh={fetchTelemetry}
    />
  );
}
