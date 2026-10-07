import type { Meta, StoryObj } from '@storybook/react';
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

const mockQrSvg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="10">QR Code</text></svg>';

export const Default: Story = {
  args: {
    qrSvg: mockQrSvg,
    events: [
      {
        id: "1",
        title: "Introduction to functional programming",
        department: "Computer Science",
        summary: "Learn the basics of functional programming.",
        date: "2026-10-15",
        time: "14:00",
        location: "Auditorium A",
        lat: -12.1975,
        lng: -38.9722,
        votes: 120,
        likes: { "user-1": true },
        creatorId: "admin",
      }
    ],
    loaded: true,
    error: null,
    pendingId: null,
    onToggleLike: (id) => console.log('Toggle like for', id),
    onToggleSubscription: (id) => console.log('Toggle subscription for', id),
  },
};
