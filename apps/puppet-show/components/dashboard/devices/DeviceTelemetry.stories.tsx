import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DeviceTelemetry } from './DeviceTelemetry';

const meta = {
  title: 'Dashboard/Devices/DeviceTelemetry',
  component: DeviceTelemetry,
  parameters: { layout: 'padded' },
  args: {
    onReboot: fn(),
    onRefresh: fn(),
  },
} satisfies Meta<typeof DeviceTelemetry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    device: {
      id: 'dev-1',
      name: 'Totem Principal',
      location: 'Recepção',
      macAddress: '00:1B:44:11:3A:B7',
      telemetry: {
        cpuUsage: 45,
        memoryUsage: 850,
        temperature: 55,
        lastPing: new Date().toISOString(),
      },
    },
  },
};
