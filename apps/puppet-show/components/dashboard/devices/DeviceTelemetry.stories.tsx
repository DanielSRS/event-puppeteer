import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { DeviceTelemetry, type DeviceInfo } from './DeviceTelemetry';

const NOW = '2026-10-07T12:00:00.000Z';

const ONLINE_DEVICE: DeviceInfo = {
  id: 'dev-1',
  name: 'Totem Principal',
  location: 'Recepção',
  isOnline: true,
  lastHeartbeat: NOW,
  telemetry: {
    cpuTemp: 48.5,
    memoryUsage: 512 * 1024 * 1024,
    diskTotal: 16 * 1024 * 1024 * 1024,
    diskUsage: 6 * 1024 * 1024 * 1024,
    uptime: 93600,
    osVersion: 'Raspberry Pi OS 12',
    kernelVersion: '6.6.31-v8+',
    puppetVersion: '0.4.0',
    puppetMemoryUsage: 64 * 1024 * 1024,
    networkInfo: '10.0.0.42',
  },
  commands: [
    { id: 'c1', deviceId: 'dev-1', type: 'restart', status: 'completed', issuedBy: 'u1', issuedAt: NOW },
    { id: 'c2', deviceId: 'dev-1', type: 'request_telemetry', status: 'failed', issuedBy: 'u1', issuedAt: NOW },
  ],
  logs: [
    { id: 'l1', deviceId: 'dev-1', level: 'info', message: 'Puppet iniciado', timestamp: NOW },
    { id: 'l2', deviceId: 'dev-1', level: 'error', message: 'Falha ao baixar banner', timestamp: NOW },
  ],
};

const meta = {
  title: 'Dashboard/Devices/DeviceTelemetry',
  component: DeviceTelemetry,
  parameters: { layout: 'padded' },
  args: {
    device: ONLINE_DEVICE,
    onCommand: fn(),
    onRefresh: fn(),
  },
} satisfies Meta<typeof DeviceTelemetry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('Online')).toBeInTheDocument();
    await expect(canvas.getByText('512.0 MB')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Pedir telemetria/ }));
    await expect(args.onCommand).toHaveBeenCalledWith('request_telemetry');
    await userEvent.click(canvas.getByRole('button', { name: 'Recarregar dados' }));
    await expect(args.onRefresh).toHaveBeenCalled();
  },
};

export const OfflineWithoutTelemetry: Story = {
  args: {
    device: { id: 'dev-2', isOnline: false, telemetry: null, commands: [], logs: [] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Offline')).toBeInTheDocument();
    await expect(canvas.getByText(/ainda não enviou telemetria/)).toBeInTheDocument();
  },
};

export const WithHeartbeatErrors: Story = {
  args: {
    device: { ...ONLINE_DEVICE, heartbeatErrors: ['HDMI desconectado', 'Sem espaço em disco'] },
  },
};

export const SendingCommand: Story = {
  args: { sendingCommand: 'restart' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Reiniciar/ })).toBeDisabled();
  },
};
