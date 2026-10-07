import type { Meta, StoryObj } from '@storybook/react';
import NewEventPage from './page';

const meta = {
  title: 'Pages/Eventos/Novo',
  component: NewEventPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof NewEventPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
