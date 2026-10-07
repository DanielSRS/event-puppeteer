import React from 'react';
import {
  MdRefresh, MdPowerSettingsNew, MdRestartAlt, MdTerminal, MdSensors,
  MdThermostat, MdMemory, MdStorage, MdTimer,
} from 'react-icons/md';
import type { Command, CommandType, DeviceLog, DeviceTelemetry as TelemetryData } from '@/lib/api/types';

export type DeviceAction = Extract<CommandType, 'restart' | 'shutdown' | 'open_ssh' | 'request_telemetry'>;

export interface DeviceInfo {
  id: string;
  name?: string;
  location?: string;
  isOnline: boolean;
  lastHeartbeat?: string;
  heartbeatErrors?: string[];
  telemetry: TelemetryData | null;
  commands: Command[];
  logs: DeviceLog[];
}

interface DeviceTelemetryProps {
  device: DeviceInfo;
  /* THE COMMAND BEING SENT RIGHT NOW, TO DISABLE THE BUTTONS */
  sendingCommand?: DeviceAction | null;
  onCommand: (type: DeviceAction) => void;
  onRefresh: () => void;
}

const COMMAND_LABELS: Record<CommandType, string> = {
  restart: 'Reiniciar',
  shutdown: 'Desligar',
  update: 'Atualizar',
  open_ssh: 'Abrir SSH',
  custom: 'Personalizado',
  request_telemetry: 'Pedir telemetria',
};

const STATUS_LABELS: Record<Command['status'], string> = {
  pending: 'Pendente',
  sent: 'Enviado',
  acknowledged: 'Recebido',
  completed: 'Concluído',
  failed: 'Falhou',
};

function FormatBytes(bytes?: number) {
  if (bytes === undefined) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function FormatUptime(seconds?: number) {
  if (seconds === undefined) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}min`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface p-5 rounded-lg shadow-sm border border-muted flex flex-col items-center text-center">
      {icon}
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-sm text-foreground/60">{label}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="text-foreground font-mono text-right break-all">{value || '-'}</dd>
    </div>
  );
}

export function DeviceTelemetry({ device, sendingCommand = null, onCommand, onRefresh }: DeviceTelemetryProps) {
  const t = device.telemetry;
  const busy = sendingCommand !== null;

  const confirmAndSend = (type: DeviceAction, question: string) => {
    if (confirm(question)) onCommand(type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface p-6 rounded-lg shadow-sm border flex flex-wrap items-center justify-between gap-4 border-muted">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">{device.name || device.id}</h2>
            {device.isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success ring-1 ring-inset ring-success/30">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger ring-1 ring-inset ring-danger/30">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Offline
              </span>
            )}
          </div>
          <div className="text-sm text-foreground/60 mt-1 flex flex-wrap items-center gap-4">
            {device.location && <span>Local: {device.location}</span>}
            <span>
              Último sinal: {device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'nunca'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-foreground/70 bg-muted hover:bg-white/10 rounded-md"
            title="Recarregar dados"
            aria-label="Recarregar dados"
          >
            <MdRefresh className="w-5 h-5" />
          </button>
          <button
            onClick={() => onCommand('request_telemetry')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-foreground bg-muted hover:bg-white/10 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdSensors className="w-4 h-4" /> Pedir telemetria
          </button>
          <button
            onClick={() => confirmAndSend('open_ssh', 'Abrir acesso SSH neste dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-foreground bg-muted hover:bg-white/10 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdTerminal className="w-4 h-4" /> Abrir SSH
          </button>
          <button
            onClick={() => confirmAndSend('restart', 'Tem certeza que deseja reiniciar o dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-main bg-main/10 hover:bg-main/20 border border-main/40 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdRestartAlt className="w-4 h-4" /> Reiniciar
          </button>
          <button
            onClick={() => confirmAndSend('shutdown', 'Tem certeza que deseja desligar o dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-danger bg-danger/10 hover:bg-danger/20 border border-danger/40 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdPowerSettingsNew className="w-4 h-4" /> Desligar
          </button>
        </div>
      </div>

      {device.heartbeatErrors && device.heartbeatErrors.length > 0 && (
        <div role="alert" className="p-4 bg-danger/10 border border-danger/40 rounded-lg text-sm text-danger">
          <p className="font-medium mb-1">Erros reportados pelo dispositivo:</p>
          <ul className="list-disc ml-5">
            {device.heartbeatErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Metrics */}
      {t ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric
              icon={<MdThermostat className="w-7 h-7 text-main mb-2" />}
              label="Temperatura (CPU)"
              value={t.cpuTemp !== undefined ? `${t.cpuTemp.toFixed(1)}°C` : '-'}
            />
            <Metric
              icon={<MdMemory className="w-7 h-7 text-main mb-2" />}
              label="Memória em uso"
              value={FormatBytes(t.memoryUsage)}
            />
            <Metric
              icon={<MdStorage className="w-7 h-7 text-success mb-2" />}
              label="Disco em uso"
              value={t.diskTotal ? `${FormatBytes(t.diskUsage)} / ${FormatBytes(t.diskTotal)}` : FormatBytes(t.diskUsage)}
            />
            <Metric
              icon={<MdTimer className="w-7 h-7 text-main mb-2" />}
              label="Ligado há"
              value={FormatUptime(t.uptime)}
            />
          </div>

          <dl className="bg-surface px-6 py-2 rounded-lg shadow-sm border divide-y divide-muted border-muted">
            <Detail label="Sistema" value={t.osVersion} />
            <Detail label="Kernel" value={t.kernelVersion} />
            <Detail label="Versão do Puppet" value={t.puppetVersion} />
            <Detail label="Memória do Puppet" value={t.puppetMemoryUsage !== undefined ? FormatBytes(t.puppetMemoryUsage) : undefined} />
            <Detail label="Rede" value={t.networkInfo} />
            <Detail label="Resolução" value={t.screenResolution} />
            <Detail label="HDMI" value={t.hdmiConnected === undefined ? undefined : t.hdmiConnected ? 'Conectado' : 'Desconectado'} />
            <Detail label="Tela" value={t.screenOn === undefined ? undefined : t.screenOn ? 'Ligada' : 'Desligada'} />
          </dl>
        </>
      ) : (
        <div className="p-6 bg-background border border-dashed rounded-lg text-center text-foreground/60 text-sm border-muted">
          O dispositivo ainda não enviou telemetria. Use &quot;Pedir telemetria&quot; para solicitar.
        </div>
      )}

      {/* Commands */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-3">Comandos</h3>
        {device.commands.length === 0 ? (
          <p className="text-sm text-foreground/60">Nenhum comando enviado.</p>
        ) : (
          <div className="overflow-hidden bg-surface shadow-sm ring-1 ring-muted sm:rounded-lg">
            <table className="min-w-full divide-y divide-muted">
              <thead className="bg-background">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-foreground">Comando</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-foreground">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {device.commands.map(cmd => (
                  <tr key={cmd.id}>
                    <td className="py-3 pl-4 pr-3 text-sm text-foreground">{COMMAND_LABELS[cmd.type]}</td>
                    <td className={`px-3 py-3 text-sm ${cmd.status === 'failed' ? 'text-danger' : 'text-foreground/70'}`}>
                      {STATUS_LABELS[cmd.status]}
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground/60">{new Date(cmd.issuedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Logs */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-3">Logs</h3>
        {device.logs.length === 0 ? (
          <p className="text-sm text-foreground/60">Nenhum log recebido.</p>
        ) : (
          <ul className="bg-background text-foreground rounded-lg p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
            {device.logs.map(log => (
              <li key={log.id}>
                <span className="text-foreground/50">{new Date(log.timestamp).toLocaleString()}</span>{' '}
                <span className={log.level === 'error' ? 'text-danger' : log.level === 'warn' ? 'text-main' : 'text-success'}>
                  [{log.level}]
                </span>{' '}
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
