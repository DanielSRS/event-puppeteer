import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LoginPage from './page';

const meta = {
  title: 'Pages/Entrar',
  component: LoginPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
