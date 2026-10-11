import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ResetPasswordForm } from "./ResetPasswordForm";

/** New password from the emailed link. */
const meta = {
  title: "Components/Forms/ResetPasswordForm",
  component: ResetPasswordForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { hasToken: true, saving: false, error: "", linkExpired: false, onSubmit: fn() },
} satisfies Meta<typeof ResetPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Short and mismatched passwords are pointed out; a good one is submitted. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText("Nova senha"), "curta");
    await userEvent.type(canvas.getByLabelText("Repita a nova senha"), "outra");
    await userEvent.click(canvas.getByRole("button", { name: "Salvar nova senha" }));
    await expect(canvas.getByLabelText("Nova senha")).toHaveAccessibleDescription("A senha precisa ter pelo menos 8 caracteres.");
    await expect(canvas.getByLabelText("Repita a nova senha")).toHaveAccessibleDescription("As senhas não são iguais.");
    await expect(args.onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(canvas.getByLabelText("Nova senha"));
    await userEvent.type(canvas.getByLabelText("Nova senha"), "nova-senha-1");
    await userEvent.clear(canvas.getByLabelText("Repita a nova senha"));
    await userEvent.type(canvas.getByLabelText("Repita a nova senha"), "nova-senha-1");
    await userEvent.click(canvas.getByRole("button", { name: "Salvar nova senha" }));
    await expect(args.onSubmit).toHaveBeenCalledWith("nova-senha-1");
  },
};

/** While saving, the button says so and is disabled. */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  },
};

/** An invalid, expired or used link offers to ask for a new one. */
export const LinkExpired: Story = {
  args: { linkExpired: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Este link é inválido, expirou ou já foi usado.");
    await expect(canvas.getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute("href", "/esqueci-senha");
  },
};

/** Opened without a token (a truncated link). */
export const MissingToken: Story = {
  args: { hasToken: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("O link de redefinição está incompleto.");
    await expect(canvas.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  },
};

/** Any other failure is explained and the form stays. */
export const Failed: Story = {
  args: { error: "Não foi possível salvar a nova senha. O servidor encontrou um erro. Tente de novo em instantes." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível salvar a nova senha.");
  },
};
