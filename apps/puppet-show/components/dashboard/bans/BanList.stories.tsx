import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { BanList } from "./BanList";

const meta = {
  title: "Dashboard/Bans/BanList",
  component: BanList,
  parameters: { layout: "padded" },
  args: {
    users: [
      { id: "u1", name: "João Silva", email: "joao.silva@example.com" },
      { id: "u2", name: "Maria Souza", email: "maria.souza@example.com" },
    ],
    busyUserId: null,
    onLiftBan: fn(),
  },
} satisfies Meta<typeof BanList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each person has a labelled button that asks to lift their ban. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: "Em shadow ban (2)" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Remover banimento de Maria Souza" }));
    await expect(args.onLiftBan).toHaveBeenCalledWith({ id: "u2", name: "Maria Souza", email: "maria.souza@example.com" });
  },
};

/** While a ban is being lifted its button is disabled. */
export const Lifting: Story = {
  args: { busyUserId: "u1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Remover banimento de João Silva" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Remover banimento de Maria Souza" })).toBeEnabled();
  },
};

/** Nobody banned. */
export const Empty: Story = {
  args: { users: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Nenhum usuário banido" })).toBeInTheDocument();
  },
};
