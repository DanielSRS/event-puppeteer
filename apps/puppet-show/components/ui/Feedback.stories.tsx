import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { ErrorAlert, LoadingMessage, StatusMessage } from "./Feedback";

/** Error, confirmation and loading messages used across the app. */
const meta = {
  title: "Components/UI/Feedback",
  component: ErrorAlert,
  tags: ["autodocs"],
  args: { children: "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo." },
} satisfies Meta<typeof ErrorAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Errors are announced right away to screen readers. */
export const ErrorMessage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor");
  },
};

/** An empty message renders nothing, so containers can pass their error state unconditionally. */
export const EmptyErrorRendersNothing: Story = {
  args: { children: "" },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

/** Confirmations are announced politely. */
export const Status: Story = {
  render: () => <StatusMessage>Denúncia enviada. Obrigado por ajudar a moderar o mural.</StatusMessage>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Denúncia enviada");
  },
};

/** Loading text is a busy status region. */
export const Loading: Story = {
  render: () => <LoadingMessage>Carregando eventos...</LoadingMessage>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveAttribute("aria-busy", "true");
  },
};
