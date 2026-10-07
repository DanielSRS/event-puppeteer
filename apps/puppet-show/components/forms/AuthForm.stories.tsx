import type { Meta, StoryObj } from '@storybook/react';
import { AuthForm } from './AuthForm';

const meta = {
  title: 'Components/Forms/AuthForm',
  component: AuthForm,
  parameters: {
    layout: 'centered',
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
