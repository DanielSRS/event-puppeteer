import type { Meta, StoryObj } from '@storybook/react';
import { EventForm } from './EventForm';

const meta = {
  title: 'Components/Forms/EventForm',
  component: EventForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EventForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
