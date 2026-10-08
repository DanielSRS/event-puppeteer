import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { UpdateCommandForm } from "./UpdateCommandForm";

const meta = {
  title: "Dashboard/Devices/UpdateCommandForm",
  component: UpdateCommandForm,
  parameters: { layout: "padded" },
  args: { saving: false, error: "", onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof UpdateCommandForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty fields are pointed out; a valid absolute URL is accepted without a version. */
export const Validation: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Endereço do Puppet")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Informe o SHA-256 do arquivo.")).toBeInTheDocument();

    await userEvent.type(canvas.getByLabelText("Endereço do Puppet"), "https://cdn.example.org/puppet");
    await userEvent.type(canvas.getByLabelText("SHA-256"), "D".repeat(64));
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ url: "https://cdn.example.org/puppet", sha256: "D".repeat(64) });
  },
};

/** Sending: buttons disabled. */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  },
};

/** The API refused the command. */
export const Refused: Story = {
  args: { error: "Os dados enviados foram recusados pelo servidor." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("recusados");
  },
};
