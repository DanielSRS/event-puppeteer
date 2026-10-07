import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { UserList } from './UserList';

const meta = {
  title: 'Dashboard/Users/UserList',
  component: UserList,
  parameters: {
    layout: 'padded',
  },
  args: {
    onChangeRole: fn(),
    onRemoveUser: fn(),
  },
} satisfies Meta<typeof UserList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    users: [
      {
        id: 'u1',
        name: 'Alice Admin',
        email: 'alice@uefs.br',
        role: 'Admin',
        joinedAt: '2023-01-10T00:00:00Z',
      },
      {
        id: 'u2',
        name: 'Bob Moderador',
        email: 'bob@uefs.br',
        role: 'Moderator',
        joinedAt: '2023-05-15T00:00:00Z',
      },
      {
        id: 'u3',
        name: 'Charlie Membro',
        email: 'charlie@uefs.br',
        role: 'Member',
        joinedAt: '2023-11-01T00:00:00Z',
      },
    ],
  },
};
