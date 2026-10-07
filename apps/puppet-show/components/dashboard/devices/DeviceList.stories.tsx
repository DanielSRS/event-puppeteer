import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DeviceList } from './DeviceList';

const meta = {
  title: 'Dashboard/Devices/DeviceList',
  component: DeviceList,
  parameters: {
    layout: 'padded',
  },
  args: {
    onApproveDevice: fn(),
  },
} satisfies Meta<typeof DeviceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    devices: [
      {
        id: 'dev-1',
        macAddress: '00:1B:44:11:3A:B7',
        status: 'pending',
        lastSeen: new Date().toISOString(),
      },
      {
        id: 'dev-2',
        macAddress: '00:1B:44:11:3A:C8',
        name: 'Totem Refeitório',
        location: 'Prédio Principal',
        status: 'active',
        lastSeen: new Date().toISOString(),
      },
      {
        id: 'dev-3',
        macAddress: '00:1B:44:11:3A:D9',
        name: 'Totem Biblioteca',
        location: 'Biblioteca Central',
        status: 'offline',
        lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ],
  },
};

export const OnlyPending: Story = {
  args: {
    devices: [
      {
        id: 'dev-1',
        macAddress: '00:1B:44:11:3A:B7',
        status: 'pending',
        lastSeen: new Date().toISOString(),
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    devices: [],
  },
};
