import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { UserEventList, type UserEventItem } from './UserEventList';

const meta = {
  title: 'Components/Dashboard/Events/UserEventList',
  component: UserEventList,
  parameters: {
    layout: 'padded',
  },
  args: {
    onEdit: fn(),
    onDelete: fn(),
  },
  tags: ['autodocs'],
} satisfies Meta<typeof UserEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

const MOCK_EVENTS: UserEventItem[] = [
  {
    id: "evt-1",
    title: "Feira de Ciências da Computação",
    description: "Apresentação dos projetos finais.",
    date: "2026-11-20",
    time: "14:00",
    location: "Laboratório 1",
    authorName: "Você",
    likes: 45,
    subscriptions: 120,
    liked: false,
    subscribed: false,
    status: "ACTIVE",
  },
  {
    id: "evt-2",
    title: "Palestra sobre React e RSCs",
    description: "Entendendo os Server Components.",
    date: "2026-10-01",
    time: "19:00",
    location: "Auditório B",
    authorName: "Você",
    likes: 312,
    subscriptions: 250,
    liked: false,
    subscribed: false,
    status: "PAST",
  },
  {
    id: "evt-3",
    title: "Encontro de Calouros (Cancelado)",
    description: "Cancelado devido à chuva.",
    date: "2026-10-15",
    time: "09:00",
    location: "Praça Principal",
    authorName: "Você",
    likes: 5,
    subscriptions: 12,
    liked: false,
    subscribed: false,
    status: "HIDDEN",
  },
];

export const Loaded: Story = {
  args: {
    events: MOCK_EVENTS,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    events: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    events: [],
    loading: false,
  },
};
