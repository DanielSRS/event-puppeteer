import type { Meta, StoryObj } from '@storybook/react';
import { EventShowcase } from './EventShowcase';

const meta = {
  title: 'Components/Events/EventShowcase',
  component: EventShowcase,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EventShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockEvents = [
  {
    id: 1,
    title: 'Feira de Tecnologia',
    description: 'Venha conhecer as novidades.',
    location: 'Centro de Convenções',
    date: '2026-10-15',
    time: '09:00',
    authorId: 1,
    authorName: 'João Silva',
    likes: 42,
    subscriptions: 150,
    liked: false,
    subscribed: false,
  },
  {
    id: 2,
    title: 'Workshop de React',
    description: 'Aprenda React.',
    location: 'Auditório',
    date: '2026-10-16',
    time: '14:00',
    authorId: 2,
    authorName: 'Maria',
    likes: 15,
    subscriptions: 30,
    liked: false,
    subscribed: false,
  },
];

export const Default: Story = {
  args: {
    events: mockEvents,
    loaded: true,
  },
};

export const Loading: Story = {
  args: {
    events: [],
    loaded: false,
  },
};

export const Empty: Story = {
  args: {
    events: [],
    loaded: true,
  },
};
