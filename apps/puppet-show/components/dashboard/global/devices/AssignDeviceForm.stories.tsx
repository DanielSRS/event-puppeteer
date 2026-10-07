import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { AssignDeviceForm } from './AssignDeviceForm';

const meta = {
  title: 'Dashboard/Global/AssignDeviceForm',
  component: AssignDeviceForm,
  parameters: { layout: 'padded' },
  args: {
    organizations: [
      { id: 'org-1', name: 'Universidade Estadual de Feira de Santana' },
      { id: 'org-2', name: 'Universidade Federal da Bahia' },
    ],
    isSaving: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof AssignDeviceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args }) => {
    const submit = canvas.getByRole('button', { name: 'Atribuir e aprovar' });
    await expect(submit).toBeDisabled();

    await userEvent.selectOptions(canvas.getByLabelText('Organização'), 'org-2');
    await userEvent.type(canvas.getByLabelText('Nome do dispositivo'), 'Kiosk Bib-01');
    await userEvent.type(canvas.getByLabelText('Localização'), 'Biblioteca');
    await userEvent.click(submit);

    await expect(args.onSubmit).toHaveBeenCalledWith({
      organizationId: 'org-2',
      name: 'Kiosk Bib-01',
      location: 'Biblioteca',
    });
  },
};

export const Cancel: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cancelar' }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

export const WithError: Story = {
  args: { error: 'Não foi possível atribuir o dispositivo.' },
};

export const Saving: Story = {
  args: { isSaving: true },
};
