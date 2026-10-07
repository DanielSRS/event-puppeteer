import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { OrgForm } from './OrgForm';

const meta = {
  title: 'Dashboard/Global/OrgForm',
  component: OrgForm,
  parameters: { layout: 'padded' },
  args: {
    isSaving: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof OrgForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({ canvas, args }) => {
    const submit = canvas.getByRole('button', { name: 'Criar organização' });
    await expect(submit).toBeDisabled();

    await userEvent.type(canvas.getByLabelText('Nome'), 'Universidade Estadual');
    await expect(canvas.getByLabelText('Identificador (slug)')).toHaveValue('universidade-estadual');

    await userEvent.click(submit);
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Universidade Estadual', slug: 'universidade-estadual' }),
    );
  },
};

export const Edit: Story = {
  args: {
    initialData: {
      name: 'Universidade Estadual de Feira de Santana',
      slug: 'uefs',
      url: 'uefs.puppet-show.com',
      colorScheme: '#004c99',
    },
  },
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText('Nome'), ' - Campus');
    // Editing the name never rewrites an existing slug
    await expect(canvas.getByLabelText('Identificador (slug)')).toHaveValue('uefs');
    await userEvent.click(canvas.getByRole('button', { name: 'Salvar alterações' }));
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};

export const WithError: Story = {
  args: {
    initialData: { name: 'UFBA', slug: 'ufba' },
    error: 'Não foi possível salvar a organização.',
  },
};

export const Saving: Story = {
  args: {
    initialData: { name: 'UFBA', slug: 'ufba' },
    isSaving: true,
  },
};
