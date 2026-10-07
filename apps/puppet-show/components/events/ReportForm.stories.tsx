import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { ReportForm } from './ReportForm';

const meta = {
  title: 'Events/ReportForm',
  component: ReportForm,
  parameters: { layout: 'padded' },
  args: {
    isSending: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ReportForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    const submit = canvas.getByRole('button', { name: 'Enviar denúncia' });
    await expect(submit).toBeDisabled();

    await userEvent.click(canvas.getByLabelText('Informação incorreta'));
    await userEvent.type(canvas.getByLabelText('Comentário (opcional)'), 'Data errada');
    await userEvent.click(submit);

    await expect(args.onSubmit).toHaveBeenCalledWith({ reason: 'incorrect_information', comment: 'Data errada' });
  },
};

export const WithoutComment: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByLabelText('Spam'));
    await userEvent.click(canvas.getByRole('button', { name: 'Enviar denúncia' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ reason: 'spam' });
  },
};

export const WithError: Story = {
  args: { error: 'Não foi possível enviar a denúncia.' },
};

export const Sending: Story = {
  args: { isSending: true },
};
