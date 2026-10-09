import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import type { FeedCard } from "@/domain/feed";
import { Err, Ok, type Result } from "@/lib/result";
import { EventList } from "./EventList";

const BASE: FeedCard = {
  id: "a",
  title: "Feira de Ciências",
  description: "Projetos de estudantes.",
  location: "Pátio",
  schedule: [{ date: "2026-10-15", startTime: "14:00", endTime: "16:00" }],
  tags: [],
  voteCount: 2,
  voted: false,
  isOwn: false,
};

const CARDS: FeedCard[] = [
  BASE,
  { ...BASE, id: "b", title: "Palestra de IA", isOwn: true, voteCount: 0 },
];

/** The feed's cards with the delete confirmation. */
const meta = {
  title: "Components/Events/EventList",
  component: EventList,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    cards: CARDS,
    today: "2026-10-08",
    emptyMessage: "Nenhum evento encontrado para os critérios selecionados.",
    isLikeInFlight: () => false,
    loginPromptFor: null,
    loginRedirect: "/",
    onToggleLike: fn(),
    onDelete: fn(async () => Ok(undefined)),
  },
} satisfies Meta<typeof EventList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each event once; only the viewer's own card offers "Excluir". */
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("article")).toHaveLength(2);
    await expect(canvas.getAllByRole("button", { name: /Excluir/ })).toHaveLength(1);
  },
};

/** Deleting asks for confirmation, then says it worked. */
export const DeleteConfirmed: Story = {
  play: async ({ canvas, canvasElement, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Excluir “Palestra de IA”" }));
    const doc = canvasElement.ownerDocument;
    const confirm = Array.from(doc.querySelectorAll("dialog button")).find((b) => b.textContent === "Sim, excluir");
    if (confirm === undefined) throw new Error("confirm button not rendered");
    await userEvent.click(confirm);
    await expect(args.onDelete).toHaveBeenCalledWith("b");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("“Palestra de IA” foi excluído."));
  },
};

/** A failed delete keeps the dialog open with the reason. */
export const DeleteFailed: Story = {
  args: { onDelete: fn(async (): Promise<Result<void, string>> => Err("Você não tem permissão para fazer isso.")) },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Excluir “Palestra de IA”" }));
    const doc = canvasElement.ownerDocument;
    const confirm = Array.from(doc.querySelectorAll("dialog button")).find((b) => b.textContent === "Sim, excluir");
    if (confirm === undefined) throw new Error("confirm button not rendered");
    await userEvent.click(confirm);
    await waitFor(() => expect(doc.querySelector("dialog [role=alert]")).toHaveTextContent("Você não tem permissão"));
  },
};

/** Nothing matches: the empty message. */
export const Empty: Story = {
  args: { cards: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhum evento encontrado para os critérios selecionados.")).toBeInTheDocument();
  },
};
