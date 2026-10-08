import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ApproveDeviceForm } from "./ApproveDeviceForm";

const meta = {
  title: "Dashboard/Devices/ApproveDeviceForm",
  component: ApproveDeviceForm,
  parameters: { layout: "padded" },
  args: { identifier: "pending-mac-02", saving: false, error: "", onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof ApproveDeviceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Name and location are required; the values are trimmed. */
export const Approve: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Aprovar dispositivo" }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Nome do dispositivo")).toHaveAccessibleDescription("Informe o nome do dispositivo.");
    await expect(canvas.getByLabelText("Localização")).toHaveAccessibleDescription("Informe onde o dispositivo está.");

    await userEvent.type(canvas.getByLabelText("Nome do dispositivo"), " Totem Hall ");
    await userEvent.type(canvas.getByLabelText("Localização"), "Hall de entrada");
    await userEvent.click(canvas.getByRole("button", { name: "Aprovar dispositivo" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: "Totem Hall", location: "Hall de entrada" });
  },
};

/** Superadmin assigning an orphan device must choose the organization. */
export const AssignToOrganization: Story = {
  args: {
    onSubmit: fn(),
    identifier: "orphan-mac-01",
    organizations: [{ id: "o1", name: "Universidade Estadual" }, { id: "o2", name: "Outra Organização" }],
  },
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText("Nome do dispositivo"), "Totem");
    await userEvent.type(canvas.getByLabelText("Localização"), "Reitoria");
    await userEvent.click(canvas.getByRole("button", { name: "Aprovar dispositivo" }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Organização")).toHaveAccessibleDescription("Escolha a organização.");

    await userEvent.selectOptions(canvas.getByLabelText("Organização"), "o1");
    await userEvent.click(canvas.getByRole("button", { name: "Aprovar dispositivo" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: "Totem", location: "Reitoria", organizationId: "o1" });
  },
};

/** The API refused the approval. */
export const Failed: Story = {
  args: { error: "Não foi possível aprovar o dispositivo. Você não tem permissão para fazer isso." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Você não tem permissão");
  },
};

/** While saving the buttons are disabled; cancel works otherwise. */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Aprovando..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  },
};

/** Cancelling closes the form. */
export const Cancel: Story = {
  args: { onCancel: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};
