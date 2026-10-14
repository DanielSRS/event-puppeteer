import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { OwnEvent } from "./OwnEvents";
import { UserEventList } from "./UserEventList";

const EVENTS: OwnEvent[] = [
  {
    id: "evt-1",
    title: "Feira de Ciências",
    location: "Auditório Central",
    days: [
      { date: "2026-11-20", startTime: "14:00", endTime: "16:00" },
      { date: "2026-11-21", startTime: "09:00" },
    ],
    status: "active",
  },
  {
    id: "evt-2",
    title: "Palestra sobre acessibilidade na web",
    location: "Sala 12, Módulo 5",
    days: [{ date: "2026-10-01" }],
    status: "past",
  },
  {
    id: "evt-3",
    title: "Venda de rifas",
    location: "Praça Principal",
    days: [{ date: "2026-10-15", startTime: "09:00" }],
    status: "hidden",
  },
];

const meta = {
  title: "Components/Dashboard/Events/UserEventList",
  component: UserEventList,
  parameters: { layout: "padded" },
  // The rows stack by a container query on the dashboard's content column.
  decorators: [(Story) => <div className="dash-main"><Story /></div>],
  args: {
    state: { status: "ready", events: EVENTS },
    onDelete: fn(),
    onRetry: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof UserEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every status, multi-day schedule, link to the public page and delete. */
export const Loaded: Story = {
  args: { onDelete: fn() },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText("Ativo")).toBeInTheDocument();
    await expect(canvas.getByText("Encerrado")).toBeInTheDocument();
    await expect(canvas.getByText("Oculto pela moderação")).toBeInTheDocument();
    await expect(canvas.getByText("20/11/2026, 14:00–16:00")).toBeInTheDocument();
    await expect(canvas.getByText("21/11/2026, a partir de 09:00")).toBeInTheDocument();
    await expect(canvas.getByText("01/10/2026, dia todo")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Ver página de Feira de Ciências" })).toHaveAttribute("href", "/eventos/evt-1");
    await expect(canvas.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Excluir Venda de rifas" }));
    await expect(args.onDelete).toHaveBeenCalledWith(EVENTS[2]);
  },
};

/** The status filter keeps only the events in that situation. */
export const Filtered: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("3 eventos")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Ocultos" }));
    await expect(canvas.getByRole("button", { name: "Ocultos" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText("1 evento")).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Venda de rifas" })).toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "Feira de Ciências" })).not.toBeInTheDocument();
  },
};

/** On a phone the rows stack into cards. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Carregando seus eventos");
  },
};

export const Empty: Story = {
  args: { state: { status: "ready", events: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/ainda não criou nenhum evento/)).toBeInTheDocument();
  },
};

export const LoadFailed: Story = {
  args: {
    state: { status: "error", message: "Não foi possível carregar seus eventos. Não foi possível falar com o servidor." },
    onRetry: fn(),
  },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(/falar com o servidor/);
    await userEvent.click(canvas.getByRole("button", { name: "Tentar de novo" }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
