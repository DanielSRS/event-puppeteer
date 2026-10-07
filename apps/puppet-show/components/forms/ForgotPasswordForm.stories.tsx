import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { ForgotPasswordForm } from './ForgotPasswordForm';

const meta = {
  title: 'Forms/ForgotPasswordForm',
  component: ForgotPasswordForm,
  parameters: { layout: 'centered' },
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Success: Story = {
  args: {
    isLoading: false,
    successMessage: 'Enviamos um link de recuperação para o seu e-mail. Verifique sua caixa de entrada.',
  },
};
