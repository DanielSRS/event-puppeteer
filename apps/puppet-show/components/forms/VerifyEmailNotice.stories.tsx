import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { VerifyEmailNotice } from './VerifyEmailNotice';

const meta = {
  title: 'Components/Forms/VerifyEmailNotice',
  component: VerifyEmailNotice,
  parameters: { layout: 'centered' },
  args: {
    email: 'maria@uefs.br',
    onResend: fn(),
  },
} satisfies Meta<typeof VerifyEmailNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('maria@uefs.br')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Reenviar e-mail' }));
    await expect(args.onResend).toHaveBeenCalled();
  },
};

export const Resending: Story = {
  args: { resending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
  },
};

export const Resent: Story = {
  args: { resent: true },
};

export const ResendFailed: Story = {
  args: { error: 'Não foi possível reenviar o e-mail.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Não foi possível reenviar');
  },
};
