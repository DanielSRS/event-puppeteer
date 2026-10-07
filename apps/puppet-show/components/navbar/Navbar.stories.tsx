import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { Navbar } from './Navbar';

const meta = {
  title: 'Components/Navbar/Navbar',
  component: Navbar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  args: {
    loading: false,
    user: null,
    onLogout: fn(),
  },
};

export const LoggedIn: Story = {
  args: {
    loading: false,
    user: {
      id: "1",
      firstName: "Maria",
      lastName: "Souza",
      normalizedName: "maria souza",
      email: "maria@uefs.br",
      organizationId: "org-1",
      role: "Member",
      isShadowBanned: false,
    },
    onLogout: fn(),
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    user: null,
    onLogout: fn(),
  },
};
