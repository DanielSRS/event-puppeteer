import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FeedCard } from "@/domain/feed";
import { Ok } from "@/lib/result";
import { HomeContent } from "./HomeContent";

const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';

const BASE: FeedCard = {
  id: "a",
  title: "Feira de Ciências",
  description: "Projetos de estudantes.",
  location: "Pátio",
  schedule: [{ date: "2026-10-15" }, { date: "2026-10-16" }],
  tags: [{ id: "tech", name: "Tecnologia" }],
  voteCount: 1,
  voted: false,
  isOwn: false,
};

/** In the API's ranking. */
const CARDS: FeedCard[] = [
  BASE,
  { ...BASE, id: "b", title: "Palestra de IA", location: "Módulo 5", schedule: [{ date: "2026-10-20", startTime: "09:00" }], tags: [], voteCount: 7 },
  { ...BASE, id: "c", title: "Semana de Calouros", schedule: [{ date: "2026-10-09", startTime: "14:00" }], tags: [{ id: "cult", name: "Cultura" }], voteCount: 3 },
];

/** The home page: search, pills and the feed. */
const meta = {
  title: "Components/Home/HomeContent",
  component: HomeContent,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    qr: Ok({ url: "https://mural.example.org", svg: QR_SVG }),
    status: { kind: "ready" },
    cards: CARDS,
    today: "2026-10-08",
    updatedAt: Date.now(),
    errors: [],
    loginPromptFor: null,
    isLikeInFlight: () => false,
    onToggleLike: fn(),
    onDelete: fn(async () => Ok(undefined)),
  },
} satisfies Meta<typeof HomeContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Titles of the cards, in order. */
function Titles(canvasElement: HTMLElement): string[] {
  return Array.from(canvasElement.querySelectorAll("article h2")).map((h) => h.textContent ?? "");
}

/** The pills and the search change what is shown; nothing matching says so. */
export const Filtering: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(Titles(canvasElement)).toEqual(["Feira de Ciências", "Palestra de IA", "Semana de Calouros"]);

    await userEvent.click(canvas.getByRole("button", { name: "Mais próximos" }));
    await expect(Titles(canvasElement)).toEqual(["Semana de Calouros", "Feira de Ciências", "Palestra de IA"]);

    await userEvent.click(canvas.getByRole("button", { name: "Mais curtidos" }));
    await expect(Titles(canvasElement)).toEqual(["Palestra de IA", "Semana de Calouros", "Feira de Ciências"]);

    const pills = within(canvas.getByRole("group", { name: "Filtrar eventos" }));
    await userEvent.click(pills.getByRole("button", { name: "Cultura" }));
    await expect(Titles(canvasElement)).toEqual(["Semana de Calouros"]);

    await userEvent.type(canvas.getByLabelText("Buscar eventos"), "feira");
    await expect(canvas.getByText("Nenhum evento encontrado para os critérios selecionados.")).toBeInTheDocument();

    await userEvent.click(pills.getByRole("button", { name: "Todos" }));
    await expect(Titles(canvasElement)).toEqual(["Feira de Ciências"]);
  },
};

export const Loading: Story = {
  args: { status: { kind: "loading" }, cards: [], updatedAt: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Carregando eventos...")).toBeInTheDocument();
  },
};

/** The feed couldn't be loaded. */
export const LoadError: Story = {
  args: { status: { kind: "error", message: "Não foi possível falar com o servidor." }, cards: [], updatedAt: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor.");
  },
};

/** A later refresh or a like failed: the list stays and the reason is shown. */
export const WithErrors: Story = {
  args: { errors: ["Não foi possível registrar sua curtida.", null, ""] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("alert")).toHaveLength(1);
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
  },
};

/** No upcoming events at all. */
export const EmptyFeed: Story = {
  args: { cards: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhum evento programado por enquanto.")).toBeInTheDocument();
  },
};

/** The site address isn't configured: the QR panel says so (visible on large screens). */
export const MissingSiteUrl: Story = {
  args: { qr: { ok: false, error: "Endereço do site não configurado: defina NEXT_PUBLIC_SITE_URL para exibir o QR Code." } },
};
