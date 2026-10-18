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
    await userEvent.click(canvas.getByLabelText("Informar um endereço"));
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Endereço do Puppet")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Informe o SHA-256 do arquivo.")).toBeInTheDocument();

    await userEvent.type(canvas.getByLabelText("Endereço do Puppet"), "https://cdn.example.org/puppet");
    await userEvent.type(canvas.getByLabelText("SHA-256"), "D".repeat(64));
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ kind: "url", payload: { url: "https://cdn.example.org/puppet", sha256: "D".repeat(64) } });
  },
};

/** A file is the default origin; it must be chosen and fit Puppet's 64 MB. */
export const FromFile: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.queryByLabelText("SHA-256")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(canvas.getByText("Escolha o arquivo do Puppet.")).toBeInTheDocument();

    const file = new File(["ELF"], "puppet");
    await userEvent.upload(canvas.getByLabelText("Arquivo do Puppet"), file);
    await userEvent.click(canvas.getByRole("button", { name: "Enviar atualização" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ kind: "file", file });
  },
};

/** Sending: buttons disabled, the step of the upload shown. */
export const Saving: Story = {
  args: { saving: true, progress: "Enviando o arquivo... 42%" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("42%");
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
