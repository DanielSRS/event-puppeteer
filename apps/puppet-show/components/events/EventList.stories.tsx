import type { Meta, StoryObj } from '@storybook/react';
import { EventList } from './EventList';

const meta = {
  title: 'Components/Events/EventList',
  component: EventList,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EventList>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockEvents = [
  {
    id: 1,
    title: 'Feira de Tecnologia',
    description: 'Venha conhecer as novidades do mundo da tecnologia.',
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
    description: 'Aprenda a criar aplicações modernas com React e Next.js.',
    location: 'Auditório Principal',
    date: '2026-10-16',
    time: '14:00',
    authorId: 2,
    authorName: 'Maria Souza',
    likes: 15,
    subscriptions: 30,
    liked: true,
    subscribed: true,
  },
];

export const Loaded: Story = {
  args: {
    events: mockEvents,
    loaded: true,
    error: '',
    pendingId: null,
    onToggleLike: (id) => console.log('Toggle like', id),
    onToggleSubscription: (id) => console.log('Toggle subscription', id),
  },
};

export const Loading: Story = {
  args: {
    events: [],
    loaded: false,
    error: '',
    pendingId: null,
    onToggleLike: () => {},
    onToggleSubscription: () => {},
  },
};

export const Empty: Story = {
  args: {
    events: [],
    loaded: true,
    error: '',
    pendingId: null,
    onToggleLike: () => {},
    onToggleSubscription: () => {},
  },
};

export const WithError: Story = {
  args: {
    events: mockEvents,
    loaded: true,
    error: 'Não foi possível carregar alguns eventos.',
    pendingId: null,
    onToggleLike: () => {},
    onToggleSubscription: () => {},
  },
};
