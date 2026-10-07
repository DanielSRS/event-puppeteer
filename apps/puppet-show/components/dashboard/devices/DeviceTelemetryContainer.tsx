'use client';

import React, { useState, useEffect } from 'react';
import { DeviceTelemetry, DeviceInfo, DeviceAction } from './DeviceTelemetry';
import { api, ApiError } from '@/lib/api/client';
import { useDashboard, SelectOrgNotice } from '../DashboardContext';

interface Props {
  deviceId: string;
}

const REFRESH_INTERVAL = 10000;

export function DeviceTelemetryContainer({ deviceId }: Props) {
  const { orgId } = useDashboard();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingCommand, setSendingCommand] = useState<DeviceAction | null>(null);
  // Bumping this asks the effect below to fetch everything again
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orgId) return;

    const load = () => {
      Promise.all([
        api.devices.get(orgId, deviceId),
        api.devices.status(orgId, deviceId),
        api.devices.telemetry(orgId, deviceId),
        api.devices.commands(orgId, deviceId),
        api.devices.logs(orgId, deviceId),
      ])
        .then(([info, status, telemetry, commands, logs]) => {
          setDevice({
            id: info.id,
            name: info.name,
            location: info.location,
            isOnline: status.isOnline,
            lastHeartbeat: status.latestHeartbeat?.timestamp,
            heartbeatErrors: status.latestHeartbeat?.errors,
            telemetry,
            commands: [...commands].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
            logs: [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
          });
          setError('');
        })
        .catch(err => setError(err instanceof ApiError && err.status === 404
          ? 'Dispositivo não encontrado nesta organização.'
          : 'Erro ao carregar o dispositivo.'));
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [orgId, deviceId, reloadKey]);

  const handleCommand = async (type: DeviceAction) => {
    if (!orgId) return;
    setSendingCommand(type);
    setNotice('');
    try {
      await api.devices.sendCommand(orgId, deviceId, { type });
      setNotice('Comando enviado. O dispositivo vai executá-lo na próxima sincronização.');
      setReloadKey(k => k + 1);
    } catch {
      setError('Não foi possível enviar o comando.');
    } finally {
      setSendingCommand(null);
    }
  };

  if (!orgId) return <SelectOrgNotice />;
  if (!device && error) return <div className="p-8 text-center text-foreground/60">{error}</div>;
  if (!device) return <div className="p-8 text-center text-foreground/60 animate-pulse">Carregando dispositivo...</div>;

  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-success">{notice}</p>}
      <DeviceTelemetry
        device={device}
        sendingCommand={sendingCommand}
        onCommand={handleCommand}
        onRefresh={() => setReloadKey(k => k + 1)}
      />
    </>
  );
}
