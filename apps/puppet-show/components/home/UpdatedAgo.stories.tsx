import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { UpdatedAgo } from "./UpdatedAgo";

/** How fresh the feed is. */
const meta = {
  title: "Components/Home/UpdatedAgo",
  component: UpdatedAgo,
  tags: ["autodocs"],
  args: { updatedAt: Date.now() - 12_000 },
} satisfies Meta<typeof UpdatedAgo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SecondsAgo: Story = {
  // Measured when the story renders, not when the file loads (the suite may run much later).
  render: () => <UpdatedAgo updatedAt={Date.now() - 12_000} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/Atualizado há 1\d s/)).toBeInTheDocument();
  },
};
