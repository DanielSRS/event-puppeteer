import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { AuthForm } from './AuthForm';

const meta = {
  title: 'Components/Forms/AuthForm',
  component: AuthForm,
  parameters: {
    layout: 'centered',
  },
  args: {
    onSubmit: fn(),
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = {
  args: {
    mode: 'login',
  },
};

export const Register: Story = {
  args: {
    mode: 'register',
  },
};

export const Loading: Story = {
  args: {
    mode: 'login',
    loading: true,
  },
};

export const WithError: Story = {
  args: {
    mode: 'login',
    generalError: 'E-mail ou senha incorretos.',
  },
};

export const EmailVerified: Story = {
  args: {
    mode: 'login',
    notice: 'E-mail confirmado, faça login.',
  },
};

export const EmailNotVerified: Story = {
  args: {
    mode: 'login',
    generalError: 'Seu e-mail ainda não foi confirmado.',
    onResendVerification: fn(),
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reenviar e-mail de confirmação' }));
    await expect(args.onResendVerification).toHaveBeenCalled();
  },
};
