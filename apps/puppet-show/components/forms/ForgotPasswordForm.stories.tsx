import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

/** "Esqueci minha senha". */
const meta = {
  title: "Components/Forms/ForgotPasswordForm",
  component: ForgotPasswordForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { sending: false, sent: false, error: "", onSubmit: fn() },
} satisfies Meta<typeof ForgotPasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An invalid address is explained and nothing is sent; a valid one is sent trimmed. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Enviar link" }));
    await expect(canvas.getByLabelText("E-mail")).toHaveAccessibleDescription("Informe um e-mail válido.");
    await expect(args.onSubmit).not.toHaveBeenCalled();

    await userEvent.type(canvas.getByLabelText("E-mail"), " maria@uefs.br ");
    await userEvent.click(canvas.getByRole("button", { name: "Enviar link" }));
    await expect(args.onSubmit).toHaveBeenCalledWith("maria@uefs.br");
  },
};

/** While sending, the button says so and is disabled. */
export const Sending: Story = {
  args: { sending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  },
};

/** After sending, the same answer whether or not the account exists, plus a way back. */
export const Sent: Story = {
  args: { sent: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Se houver uma conta com esse e-mail, enviamos um link");
    await expect(canvas.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute("href", "/entrar");
  },
};

/** A failed request is explained and the form stays. */
export const Failed: Story = {
  args: { error: "Não foi possível enviar o link. Não foi possível falar com o servidor. Verifique sua conexão e tente de novo." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível enviar o link.");
    await expect(canvas.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  },
};
