import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { BanList } from './BanList';

const meta = {
  title: 'Dashboard/Bans/BanList',
  component: BanList,
  parameters: {
    layout: 'padded',
  },
  args: {
    onLiftBan: fn(),
  },
} satisfies Meta<typeof BanList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    bannedUsers: [
      {
        id: 'usr-1',
        name: 'João Silva',
        email: 'joao.silva@example.com',
        bannedAt: '2023-11-20T10:00:00Z',
        reason: 'Spam excessivo de eventos',
        reportCount: 15,
      },
      {
        id: 'usr-2',
        name: 'Maria Souza',
        email: 'maria.souza@example.com',
        bannedAt: '2023-11-25T14:30:00Z',
        reason: 'Conteúdo inapropriado repetido',
        reportCount: 22,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    bannedUsers: [],
  },
};
