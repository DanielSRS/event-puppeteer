import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import type { TvEvent } from "@/lib/api/mappers";
import { Ok } from "@/lib/result";
import { TvDisplay } from "./TvDisplay";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';

function Event(n: number, votes = 0): TvEvent {
  return { id: `e${n}`, title: `Evento ${n}`, location: `Sala ${n}`, schedule: [{ date: "2026-10-15", startTime: "14:00", endTime: "16:00" }], voteCount: votes };
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

/** Up to three events: one window, each shown once, no page counter. */
export const FewEvents: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Universidade Estadual");
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.getByText("2 curtidas")).toBeInTheDocument();
    await expect(canvas.queryByText(/Página/)).toBeNull();
    await expect(canvas.getByRole("img", { name: /QR Code/ })).toBeInTheDocument();
  },
};

/** More than three: windows of three, with a page counter. */
export const Rotating: Story = {
  args: { events: [Event(1), Event(2), Event(3), Event(4), Event(5)] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("Página 1 de 2")).toBeInTheDocument();
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
