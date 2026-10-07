import React from 'react';
import { MdRefresh, MdPowerSettingsNew, MdInfoOutline, MdMemory, MdNetworkWifi } from 'react-icons/md';

export interface TelemetryData {
  cpuUsage: number;
  memoryUsage: number;
  temperature: number;
  lastPing: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  location: string;
  macAddress: string;
  telemetry: TelemetryData;
}

interface DeviceTelemetryProps {
  device: DeviceInfo;
  onReboot: () => void;
  onRefresh: () => void;
}

export function DeviceTelemetry({ device, onReboot, onRefresh }: DeviceTelemetryProps) {
  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{device.name}</h2>
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
            <span>Local: {device.location}</span>
            <span>MAC: <span className="font-mono">{device.macAddress}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
            title="Atualizar Telemetria"
          >
            <MdRefresh className="w-5 h-5" />
          </button>
          <button
            onClick={onReboot}
            className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md text-sm font-medium"
          >
            <MdPowerSettingsNew className="w-4 h-4" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center">
          <MdMemory className="w-8 h-8 text-blue-500 mb-2" />
          <div className="text-3xl font-semibold text-gray-900">{device.telemetry.cpuUsage}%</div>
          <div className="text-sm text-gray-500">Uso de CPU</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center">
          <MdInfoOutline className="w-8 h-8 text-green-500 mb-2" />
          <div className="text-3xl font-semibold text-gray-900">{device.telemetry.memoryUsage}MB</div>
          <div className="text-sm text-gray-500">Uso de Memória RAM</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center">
          <MdNetworkWifi className="w-8 h-8 text-orange-500 mb-2" />
          <div className="text-3xl font-semibold text-gray-900">{device.telemetry.temperature}°C</div>
          <div className="text-sm text-gray-500">Temperatura (SoC)</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-right">
        Último ping: {new Date(device.telemetry.lastPing).toLocaleString()}
      </div>
    </div>
  );
}
