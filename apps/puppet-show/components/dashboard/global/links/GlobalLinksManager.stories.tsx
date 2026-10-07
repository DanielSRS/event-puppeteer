import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { GlobalLinksManager } from './GlobalLinksManager';

const meta = {
  title: 'Dashboard/Global/GlobalLinksManager',
  component: GlobalLinksManager,
  parameters: { layout: 'padded' },
  args: {
    onCreateLink: fn(),
    links: [
      { id: '1', label: 'Inscrições' },
      { id: '2', label: 'Instagram' },
      { id: '3', label: 'Transmissão Ao Vivo' },
    ],
  },
} satisfies Meta<typeof GlobalLinksManager>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.queryByTitle('Remover Rótulo')).not.toBeInTheDocument();
    await userEvent.type(canvas.getByLabelText('Rótulo do Link'), 'YouTube');
    await userEvent.click(canvas.getByRole('button', { name: /Adicionar/ }));
    await expect(args.onCreateLink).toHaveBeenCalledWith('YouTube');
  },
};

export const WithDelete: Story = {
  args: { onDeleteLink: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getAllByTitle('Remover Rótulo')[0]);
    await expect(args.onDeleteLink).toHaveBeenCalledWith('1');
  },
};

export const Empty: Story = {
  args: { links: [] },
};
