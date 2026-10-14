import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import type { TvEvent } from "@/lib/api/mappers";
import { Ok } from "@/lib/result";
import { TvDisplay } from "./TvDisplay";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';

function Event(n: number, votes = 0, date = "2026-10-15"): TvEvent {
  return {
    id: `e${n}`, title: `Evento ${n}`, location: `Sala ${n}`, schedule: [{ date, startTime: "14:00", endTime: "16:00" }], voteCount: votes,
    description: `Descrição do evento ${n}.`, banner: null, tags: [{ id: "t1", name: "Tecnologia" }],
  };
}

/** The kiosk screen. */
const meta = {
  title: "Components/TV/TvDisplay",
  component: TvDisplay,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    branding: { name: "Universidade Estadual", logo: null },
    status: "ready",
    events: [Event(1, 2), Event(2)],
    errors: [],
    qr: Ok({ url: "https://mural.example.org", svg: SVG }),
    today: "2026-10-08",
  },
} satisfies Meta<typeof TvDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One event featured at a time; the most liked one first, with "Em alta"; the agenda lists both. */
export const FewEvents: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Eventos · Universidade Estadual");
    const featured = canvas.getByRole("article", { name: "Evento em exibição" });
    await expect(featured).toHaveTextContent("Evento 1");
    await expect(featured).toHaveTextContent("Em alta");
    await expect(canvas.getByText("2 curtidas")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Agenda" }).querySelectorAll("li")).toHaveLength(2);
    await expect(canvas.getByRole("img", { name: /QR Code/ })).toBeInTheDocument();
  },
};

/** Today has events: they are listed under "Hoje"; the week counts its events and categories. */
export const Today: Story = {
  args: { events: [Event(1, 3, "2026-10-08"), Event(2, 0, "2026-10-08"), Event(3, 1, "2026-10-12")] },
  play: async ({ canvas }) => {
    const today = canvas.getByRole("region", { name: "Hoje" });
    await expect(today).toHaveTextContent("2 eventos");
    await expect(today).toHaveTextContent("Evento 1");
    await expect(canvas.getByRole("region", { name: "Próximos 7 dias" })).toHaveTextContent("3eventosem 1 categoria");
  },
};

/** More events than the agenda holds: five shown, the rest counted. */
export const Rotating: Story = {
  args: { events: [Event(1), Event(2), Event(3), Event(4), Event(5), Event(6), Event(7)] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Agenda" }).querySelectorAll("li")).toHaveLength(5);
    await expect(canvas.getByText("e mais 2 eventos no site")).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { status: "loading", events: [], branding: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Carregando eventos...")).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { events: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhum evento programado por enquanto.")).toBeInTheDocument();
  },
};

/** A kiosk still says what is wrong: failed refresh and missing site address. */
export const Errors: Story = {
  args: {
    errors: ["Não foi possível atualizar os eventos. Não foi possível falar com o servidor.", null],
    qr: { ok: false, error: "Endereço do site não configurado: defina NEXT_PUBLIC_SITE_URL para exibir o QR Code." },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("alert")).toHaveLength(2);
  },
};
