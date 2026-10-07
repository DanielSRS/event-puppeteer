import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { EventWizard } from './EventWizard';

const meta = {
  title: 'Components/Dashboard/Events/EventWizard',
  component: EventWizard,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onSave: fn(),
    onCancel: fn(),
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-[600px] max-w-2xl border border-muted mx-auto my-8 shadow-xl bg-background rounded-lg overflow-hidden flex flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    loading: false,
  },
};

export const WithInitialData: Story = {
  args: {
    loading: false,
    initialData: {
      title: 'Apresentação de TCC',
      description: 'Defesa pública do trabalho de conclusão de curso.',
      location: 'Auditório Principal',
      date: '2026-12-10',
      time: '09:00',
    },
  },
};

export const Saving: Story = {
  args: {
    loading: true,
  },
};
