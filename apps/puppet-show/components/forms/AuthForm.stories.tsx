import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
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
