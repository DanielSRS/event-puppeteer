import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SettingsForm } from './SettingsForm';

const meta = {
  title: 'Dashboard/Settings/SettingsForm',
  component: SettingsForm,
  parameters: { layout: 'padded' },
  args: {
    onSave: fn(),
  },
} satisfies Meta<typeof SettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialData: {
      shadowBanThreshold: 10,
    },
    isSaving: false,
  },
};

export const Saving: Story = {
  args: {
    initialData: {
      shadowBanThreshold: 5,
    },
    isSaving: true,
  },
};
