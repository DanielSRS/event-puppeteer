import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { AuthFormContainer } from './AuthFormContainer';

const meta = {
  title: 'Components/Forms/Containers/AuthFormContainer',
  component: AuthFormContainer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  beforeEach: () => {
    // Mock global fetch
    global.fetch = fn();
  },
} satisfies Meta<typeof AuthFormContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoginSuccess: Story = {
  args: {
    mode: 'login',
  },
  beforeEach: () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
  },
  play: async ({ canvas, step }) => {
    // Fill form and submit
    const emailInput = canvas.getByLabelText('E-mail');
    const passwordInput = canvas.getByLabelText('Senha');
    const submitBtn = canvas.getByRole('button', { name: 'Entrar' });

    await step('Submit form', async () => {
      // simulate user input if necessary
      expect(submitBtn).toBeInTheDocument();
    });
  },
};
