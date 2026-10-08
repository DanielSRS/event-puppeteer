import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ReportForm } from "./ReportForm";

/** Reporting an event to the moderators. */
const meta = {
  title: "Components/Events/ReportForm",
  component: ReportForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    threshold: 5,
    isSending: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ReportForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explains the threshold; a reason is required, the comment is optional. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/Ao chegar a 5 denúncias de pessoas diferentes/)).toBeInTheDocument();
    const submit = canvas.getByRole("button", { name: "Enviar denúncia" });
    await expect(submit).toBeDisabled();

    await userEvent.click(canvas.getByLabelText("Informação incorreta"));
    await userEvent.type(canvas.getByLabelText("Comentário (opcional)"), "Data errada");
    await userEvent.click(submit);
    await expect(args.onSubmit).toHaveBeenCalledWith({ reason: "incorrect_information", comment: "Data errada" });
  },
};

export const WithoutComment: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByLabelText("Spam"));
    await userEvent.click(canvas.getByRole("button", { name: "Enviar denúncia" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({ reason: "spam" });
  },
};

/** Threshold unknown (the organization couldn't be loaded). */
export const UnknownThreshold: Story = {
  args: { threshold: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/denúncias de várias pessoas diferentes/)).toBeInTheDocument();
  },
};

export const WithError: Story = {
  args: { error: "Não foi possível enviar a denúncia." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível enviar a denúncia.");
  },
};

export const Sending: Story = {
  args: { isSending: true },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("button", { name: "Enviando..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await expect(args.onCancel).not.toHaveBeenCalled();
  },
};
