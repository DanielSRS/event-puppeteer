import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { FeedCard } from "@/domain/feed";
import { EventCard } from "./EventCard";

const CARD: FeedCard = {
  id: "evt-1",
  title: "Feira de Ciências",
  description: "Projetos de estudantes de todos os cursos, com oficinas abertas ao público.",
  location: "Pátio do Módulo 1",
  schedule: [
    { date: "2026-10-15", startTime: "14:00", endTime: "16:00" },
    { date: "2026-10-16", startTime: "14:00", endTime: "16:00" },
    { date: "2026-10-17", startTime: "14:00", endTime: "16:00" },
  ],
  tags: [{ id: "t1", name: "Tecnologia" }, { id: "t2", name: "Cultura" }],
  voteCount: 4,
  voted: false,
  isOwn: false,
};

/** One event in the public feed. */
const meta = {
  title: "Components/Events/EventCard",
  component: EventCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { card: CARD, today: "2026-10-08", onToggleLike: fn(), onDelete: fn() },
} satisfies Meta<typeof EventCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Badge, time range, "3 dias", place, tags, like counter and a link to the details. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText("14:00 – 16:00")).toBeInTheDocument();
    await expect(canvas.getByText("3 dias")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Feira de Ciências" })).toHaveAttribute("href", "/eventos/evt-1");
    await expect(canvas.queryByRole("button", { name: /Excluir/ })).toBeNull();

    const like = canvas.getByRole("button", { name: "Curtir “Feira de Ciências”, 4 curtidas" });
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(like);
    await expect(args.onToggleLike).toHaveBeenCalledWith("evt-1");
  },
};

/** The viewer liked it: the heart is filled and pressed. */
export const Liked: Story = {
  args: { card: { ...CARD, voted: true, voteCount: 5 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /, 5 curtidas$/ })).toHaveAttribute("aria-pressed", "true");
  },
};

/** While the like request runs the button waits. */
export const LikeInFlight: Story = {
  args: { likeBusy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /Curtir/ })).toBeDisabled();
  },
};

/** The creator sees "Excluir". */
export const OwnEvent: Story = {
  args: { card: { ...CARD, isOwn: true } },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Excluir “Feira de Ciências”" }));
    await expect(args.onDelete).toHaveBeenCalledWith("evt-1");
  },
};

/** An anonymous visitor tried to like: the card asks them to log in and come back. */
export const LoginPrompt: Story = {
  args: { loginPrompt: true, loginRedirect: "/" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar?redirect=%2F");
  },
};

/** One day, no times, no tags. */
export const AllDay: Story = {
  args: { card: { ...CARD, schedule: [{ date: "2026-10-20" }], tags: [], voteCount: 1 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Dia todo")).toBeInTheDocument();
    await expect(canvas.queryByText("3 dias")).toBeNull();
    await expect(canvas.getByRole("button", { name: /, 1 curtida$/ })).toBeInTheDocument();
  },
};

/** Days with gaps show the range instead of a count. */
export const DaysWithGaps: Story = {
  args: { card: { ...CARD, schedule: [{ date: "2026-10-15", startTime: "09:00" }, { date: "2026-10-22", startTime: "09:00" }] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("15 out – 22 out")).toBeInTheDocument();
    await expect(canvas.getByText("A partir das 09:00")).toBeInTheDocument();
  },
};
