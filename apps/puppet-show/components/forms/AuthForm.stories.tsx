import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { AuthForm } from "./AuthForm";

/** Login and sign-up. */
const meta = {
  title: "Components/Forms/AuthForm",
  component: AuthForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { mode: "login", onSubmit: fn() },
} satisfies Meta<typeof AuthForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Invalid fields are explained and nothing is sent; valid ones are. */
export const Login: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Entrar" }));
    await expect(canvas.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    await expect(canvas.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    await expect(args.onSubmit).not.toHaveBeenCalled();

    await userEvent.type(canvas.getByLabelText("E-mail"), " maria@uefs.br ");
    await userEvent.type(canvas.getByLabelText("Senha"), "password123");
    await userEvent.click(canvas.getByRole("button", { name: "Entrar" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: "", email: "maria@uefs.br", password: "password123" });
  },
};

/** Sign-up needs first and last name; the name is formatted. Keeps ?redirect= in the other link. */
export const Register: Story = {
  args: { mode: "register", redirectPath: "/eventos/1" },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar?redirect=%2Feventos%2F1");
    await userEvent.type(canvas.getByLabelText("Nome completo"), "maria");
    await userEvent.type(canvas.getByLabelText("E-mail"), "maria@uefs.br");
    await userEvent.type(canvas.getByLabelText("Senha"), "password123");
    await userEvent.click(canvas.getByRole("button", { name: "Criar conta" }));
    await expect(canvas.getByText("Informe seu nome e sobrenome.")).toBeInTheDocument();

    await userEvent.type(canvas.getByLabelText("Nome completo"), " souza");
    await userEvent.click(canvas.getByRole("button", { name: "Criar conta" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: "Maria Souza", email: "maria@uefs.br", password: "password123" });
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Aguarde..." })).toBeDisabled();
  },
};

export const WrongPassword: Story = {
  args: { generalError: "E-mail ou senha incorretos." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
  },
};

export const EmailVerified: Story = {
  args: { notice: "E-mail confirmado, faça login." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("E-mail confirmado");
  },
};

/** Login blocked until the email is confirmed: offers to resend. */
export const EmailNotVerified: Story = {
  args: { generalError: "Seu e-mail ainda não foi confirmado.", onResendVerification: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Reenviar e-mail de confirmação" }));
    await expect(args.onResendVerification).toHaveBeenCalled();
  },
};

export const ResendFailed: Story = {
  args: { resendError: "Não foi possível reenviar o e-mail.", onResendVerification: fn() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível reenviar");
  },
};
