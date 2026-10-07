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
        identifier: 'dev-B7',
        status: 'pending',
        connectedAt: new Date().toISOString(),
      },
      {
        id: 'dev-2',
        identifier: 'dev-C8',
        name: 'Totem Refeitório',
        location: 'Prédio Principal',
        status: 'active',
        connectedAt: new Date().toISOString(),
      },
      {
        id: 'dev-3',
        identifier: 'dev-D9',
        name: 'Totem Biblioteca',
        location: 'Biblioteca Central',
        status: 'offline',
        connectedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ],
  },
};

export const OnlyPending: Story = {
  args: {
    devices: [
      {
        id: 'dev-1',
        identifier: 'dev-B7',
        status: 'pending',
        connectedAt: new Date().toISOString(),
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    devices: [],
  },
};
