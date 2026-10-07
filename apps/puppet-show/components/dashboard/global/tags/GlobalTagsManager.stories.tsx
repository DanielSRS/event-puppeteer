import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { GlobalTagsManager } from './GlobalTagsManager';

const meta = {
  title: 'Dashboard/Global/GlobalTagsManager',
  component: GlobalTagsManager,
  parameters: { layout: 'padded' },
  args: {
    onCreateTag: fn(),
    tags: [
      { id: '1', name: 'hackathon' },
      { id: '2', name: 'palestra' },
      { id: '3', name: 'festa' },
    ],
  },
} satisfies Meta<typeof GlobalTagsManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.queryByTitle('Remover Tag Global')).not.toBeInTheDocument();
    await userEvent.type(canvas.getByLabelText('Nova Tag'), 'minicurso');
    await userEvent.click(canvas.getByRole('button', { name: /Adicionar|Criar/ }));
    await expect(args.onCreateTag).toHaveBeenCalledWith('minicurso');
  },
};

export const WithUsageAndDelete: Story = {
  args: {
    onDeleteTag: fn(),
    tags: [
      { id: '1', name: 'hackathon', usageGlobal: 1200 },
      { id: '2', name: 'palestra', usageGlobal: 850 },
    ],
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/1200 eventos/)).toBeInTheDocument();
    await userEvent.click(canvas.getAllByTitle('Remover Tag Global')[0]);
    await expect(args.onDeleteTag).toHaveBeenCalledWith('1');
  },
};
