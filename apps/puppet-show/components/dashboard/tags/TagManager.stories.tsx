import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TagManager } from './TagManager';

const meta = {
  title: 'Dashboard/Tags/TagManager',
  component: TagManager,
  parameters: {
    layout: 'padded',
  },
  args: {
    onPromoteTag: fn(),
    onRejectTag: fn(),
  },
} satisfies Meta<typeof TagManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tags: [
      { id: 't1', name: 'hackathon', usageCount: 42, status: 'pending' },
      { id: 't2', name: 'festa', usageCount: 150, status: 'promoted' },
      { id: 't3', name: 'estudos', usageCount: 89, status: 'promoted' },
      { id: 't4', name: 'palestra', usageCount: 12, status: 'pending' },
      { id: 't5', name: 'esportes', usageCount: 5, status: 'pending' },
    ],
  },
};

export const Empty: Story = {
  args: {
    tags: [],
  },
};

export const AllPromoted: Story = {
  args: {
    tags: [
      { id: 't1', name: 'festa', usageCount: 150, status: 'promoted' },
      { id: 't2', name: 'estudos', usageCount: 89, status: 'promoted' },
    ],
  },
};
