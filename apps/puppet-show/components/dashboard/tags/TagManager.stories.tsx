import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { TagManager } from "./TagManager";

const meta = {
  title: "Dashboard/Tags/TagManager",
  component: TagManager,
  parameters: { layout: "padded" },
  args: {
    tags: [
      { id: "t1", name: "robotica", isSystemDefined: false },
      { id: "t2", name: "Tecnologia", isSystemDefined: true },
      { id: "t3", name: "hackathon", isSystemDefined: false },
      { id: "t4", name: "Cultura", isSystemDefined: true },
    ],
    busyTagId: null,
    onPromote: fn(),
  },
} satisfies Meta<typeof TagManager>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Free-form tags wait for review; official ones are listed apart. No reject button (the API can't). */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: /Aguardando revisão \(2\)/ })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: /Tags públicas \(2\)/ })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Rejeitar/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Promover a tag robotica" }));
    await expect(args.onPromote).toHaveBeenCalledWith({ id: "t1", name: "robotica", isSystemDefined: false });
  },
};

/** The tag being promoted has its button disabled. */
export const Promoting: Story = {
  args: { busyTagId: "t1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Promover a tag robotica" })).toBeDisabled();
  },
};

/** Nothing to review. */
export const NothingPending: Story = {
  args: { tags: [{ id: "t2", name: "Tecnologia", isSystemDefined: true }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhuma tag sugerida aguardando revisão.")).toBeInTheDocument();
  },
};

/** No tags at all. */
export const Empty: Story = {
  args: { tags: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhuma tag pública ainda.")).toBeInTheDocument();
  },
};
