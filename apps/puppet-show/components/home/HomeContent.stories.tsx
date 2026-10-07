import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HomeContent } from './HomeContent';

const meta = {
  title: 'Components/Home/HomeContent',
  component: HomeContent,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HomeContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const MOCK_EVENTS = [
  {
    id: "1",
    title: "Introduction to functional programming",
    description: "Learn the basics of functional programming.",
    date: "2026-10-15",
    time: "14:00",
    location: "Auditorium A",
    authorName: "John Doe",
    likes: 120,
    subscriptions: 50,
    liked: true,
    subscribed: false,
  }
];

export const Loaded: Story = {
  args: {
    qrSvg: "<svg></svg>",
    events: MOCK_EVENTS,
    loaded: true,
    error: "",
    pendingId: null,
    onToggleLike: (id) => console.log('Toggle like for', id),
    onToggleSubscription: (id) => console.log('Toggle subscription for', id),
  },
};

export const Loading: Story = {
  args: {
    qrSvg: "<svg></svg>",
    events: [],
    loaded: false,
    error: "",
    pendingId: null,
    onToggleLike: (id) => console.log('Toggle like for', id),
    onToggleSubscription: (id) => console.log('Toggle subscription for', id),
  },
};
