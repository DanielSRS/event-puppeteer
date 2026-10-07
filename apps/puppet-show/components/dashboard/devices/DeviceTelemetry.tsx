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
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center text-center">
      {icon}
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-mono text-right break-all">{value || '-'}</dd>
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
      <div className="bg-white p-6 rounded-lg shadow-sm border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">{device.name || device.id}</h2>
            {device.isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Offline
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-4">
            {device.location && <span>Local: {device.location}</span>}
            <span>
              Último sinal: {device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'nunca'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
            title="Recarregar dados"
            aria-label="Recarregar dados"
          >
            <MdRefresh className="w-5 h-5" />
          </button>
          <button
            onClick={() => onCommand('request_telemetry')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdSensors className="w-4 h-4" /> Pedir telemetria
          </button>
          <button
            onClick={() => confirmAndSend('open_ssh', 'Abrir acesso SSH neste dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdTerminal className="w-4 h-4" /> Abrir SSH
          </button>
          <button
            onClick={() => confirmAndSend('restart', 'Tem certeza que deseja reiniciar o dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdRestartAlt className="w-4 h-4" /> Reiniciar
          </button>
          <button
            onClick={() => confirmAndSend('shutdown', 'Tem certeza que deseja desligar o dispositivo?')}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-2 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md text-sm font-medium disabled:opacity-50"
          >
            <MdPowerSettingsNew className="w-4 h-4" /> Desligar
          </button>
        </div>
      </div>

      {device.heartbeatErrors && device.heartbeatErrors.length > 0 && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
              icon={<MdThermostat className="w-7 h-7 text-orange-500 mb-2" />}
              label="Temperatura (CPU)"
              value={t.cpuTemp !== undefined ? `${t.cpuTemp.toFixed(1)}°C` : '-'}
            />
            <Metric
              icon={<MdMemory className="w-7 h-7 text-blue-500 mb-2" />}
              label="Memória em uso"
              value={FormatBytes(t.memoryUsage)}
            />
            <Metric
              icon={<MdStorage className="w-7 h-7 text-green-500 mb-2" />}
              label="Disco em uso"
              value={t.diskTotal ? `${FormatBytes(t.diskUsage)} / ${FormatBytes(t.diskTotal)}` : FormatBytes(t.diskUsage)}
            />
            <Metric
              icon={<MdTimer className="w-7 h-7 text-purple-500 mb-2" />}
              label="Ligado há"
              value={FormatUptime(t.uptime)}
            />
          </div>

          <dl className="bg-white px-6 py-2 rounded-lg shadow-sm border divide-y divide-gray-100">
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
        <div className="p-6 bg-gray-50 border border-dashed rounded-lg text-center text-gray-500 text-sm">
          O dispositivo ainda não enviou telemetria. Use &quot;Pedir telemetria&quot; para solicitar.
        </div>
      )}

      {/* Commands */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Comandos</h3>
        {device.commands.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum comando enviado.</p>
        ) : (
          <div className="overflow-hidden bg-white shadow-sm ring-1 ring-black/5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Comando</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {device.commands.map(cmd => (
                  <tr key={cmd.id}>
                    <td className="py-3 pl-4 pr-3 text-sm text-gray-900">{COMMAND_LABELS[cmd.type]}</td>
                    <td className={`px-3 py-3 text-sm ${cmd.status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                      {STATUS_LABELS[cmd.status]}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">{new Date(cmd.issuedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Logs */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Logs</h3>
        {device.logs.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum log recebido.</p>
        ) : (
          <ul className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
            {device.logs.map(log => (
              <li key={log.id}>
                <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>{' '}
                <span className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-300' : 'text-green-300'}>
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
