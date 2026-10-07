import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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

export const Default: Story = {};
