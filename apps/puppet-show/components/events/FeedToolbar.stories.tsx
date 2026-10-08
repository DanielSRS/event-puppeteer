import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { FeedToolbar } from "./FeedToolbar";

/** Search and filter pills above the feed. */
const meta = {
  title: "Components/Events/FeedToolbar",
  component: FeedToolbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    query: "",
    filter: { kind: "all" },
    tags: [{ id: "t2", name: "Cultura" }, { id: "t1", name: "Tecnologia" }],
    onQueryChange: fn(),
    onFilterChange: fn(),
  },
} satisfies Meta<typeof FeedToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** "Todos" is pressed; picking another pill or typing reports the change. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(canvas.getByRole("button", { name: "Mais curtidos" }));
    await expect(args.onFilterChange).toHaveBeenCalledWith({ kind: "most-liked" });

    await userEvent.click(canvas.getByRole("button", { name: "Tecnologia" }));
    await expect(args.onFilterChange).toHaveBeenCalledWith({ kind: "tag", tagId: "t1" });

    await userEvent.type(canvas.getByLabelText("Buscar eventos"), "f");
    await expect(args.onQueryChange).toHaveBeenCalledWith("f");
  },
};

/** A tag pill selected. */
export const TagSelected: Story = {
  args: { filter: { kind: "tag", tagId: "t2" }, query: "feira" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Cultura" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByLabelText("Buscar eventos")).toHaveValue("feira");
  },
};

/** No public tags in the feed: only the general pills. */
export const WithoutTags: Story = {
  args: { tags: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("button")).toHaveLength(3);
  },
};
