import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EventCard } from './EventCard';

const meta = {
  title: 'Components/Events/EventCard',
  component: EventCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EventCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockEvent = {
  id: "1",
  title: 'Feira de Tecnologia',
  description: 'Venha conhecer as novidades do mundo da tecnologia. Teremos palestras e workshops sobre diversos temas.',
  location: 'Centro de Convenções',
  date: '2026-10-15',
  time: '09:00',
  authorId: 1,
  authorName: 'João Silva',
  likes: 42,
  subscriptions: 150,
  liked: false,
  subscribed: false,
};

export const Default: Story = {
  args: {
    event: mockEvent,
    position: 1,
  },
};

export const LikedAndSubscribed: Story = {
  args: {
    event: { ...mockEvent, liked: true, subscribed: true, likes: 43, subscriptions: 151 },
    position: 2,
  },
};

export const Showcase: Story = {
  args: {
    event: mockEvent,
    position: 3,
    showcase: true,
  },
};

export const Pending: Story = {
  args: {
    event: mockEvent,
    position: 4,
    pending: true,
  },
};
