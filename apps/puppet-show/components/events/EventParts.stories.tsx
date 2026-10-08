import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { DateBadge, LikeButton, TagChips } from "./EventParts";

/** The like button; the badge and chips are shown in the stories below. */
const meta = {
  title: "Components/Events/EventParts",
  component: LikeButton,
  tags: ["autodocs"],
  args: { title: "Feira de Ciências", voted: false, count: 2, onToggle: fn() },
} satisfies Meta<typeof LikeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Name includes the event and the count; clicking toggles. */
export const Like: Story = {
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole("button", { name: "Curtir “Feira de Ciências”, 2 curtidas" });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalled();
  },
};

export const Liked: Story = {
  args: { voted: true, count: 1 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /, 1 curtida$/ })).toHaveAttribute("aria-pressed", "true");
  },
};

export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button")).toBeDisabled();
  },
};

/** Calendar badges (with and without a date) and tag chips. */
export const BadgesAndChips: Story = {
  render: () => (
    <div className="row gap-4">
      <DateBadge date="2026-10-15" />
      <DateBadge date="2026-10-15" size="lg" />
      <DateBadge date={null} />
      <TagChips tags={[{ id: "a", name: "Tecnologia" }, { id: "b", name: "Cultura" }]} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("15")).toHaveLength(2);
    await expect(canvas.getByRole("img", { name: "Sem data definida" })).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Categorias" })).toBeInTheDocument();
  },
};
