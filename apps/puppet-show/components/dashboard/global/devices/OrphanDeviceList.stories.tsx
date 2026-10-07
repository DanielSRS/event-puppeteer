import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { OrphanDeviceList } from './OrphanDeviceList';

const meta = {
  title: 'Dashboard/Global/OrphanDeviceList',
  component: OrphanDeviceList,
  parameters: { layout: 'padded' },
  args: {
    onAssignToOrg: fn(),
  },
} satisfies Meta<typeof OrphanDeviceList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    devices: [
      {
        id: 'orph-1',
        identifier: 'DC:A6:32:00:11:22',
        firstSeen: new Date().toISOString(),
        ipAddress: '192.168.1.50',
      },
      {
        id: 'orph-2',
        identifier: 'B8:27:EB:12:34:56',
        firstSeen: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: '200.150.12.3',
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    devices: [],
  },
};
