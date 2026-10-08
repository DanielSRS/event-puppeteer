import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ReportList, type ReportQueueItem } from "./ReportList";

const FAIR: ReportQueueItem = {
  eventId: "evt-1",
  count: 3,
  reasons: [{ reason: "spam", count: 2 }, { reason: "offensive_content", count: 1 }],
  comments: [
    { id: "r3", comment: "Parece propaganda", createdAt: "2026-10-03T13:00:00Z" },
    { id: "r1", comment: "Mesmo texto em vários eventos", createdAt: "2026-10-01T13:00:00Z" },
  ],
  firstReportedAt: "2026-10-01T13:00:00Z",
  lastReportedAt: "2026-10-03T13:00:00Z",
  event: { kind: "loaded", title: "Feira de Ciências", isHidden: false, isDeleted: false },
};

const HIDDEN: ReportQueueItem = {
  eventId: "evt-2",
  count: 1,
  reasons: [{ reason: "duplicate", count: 1 }],
  comments: [],
  firstReportedAt: "2026-10-02T13:00:00Z",
  lastReportedAt: "2026-10-02T13:00:00Z",
  event: { kind: "loaded", title: "Palestra de IA", isHidden: true, isDeleted: false },
};

const meta = {
  title: "Dashboard/Reports/ReportList",
  component: ReportList,
  parameters: { layout: "padded" },
  args: { items: [FAIR, HIDDEN], busyEventId: null, onSetHidden: fn() },
} satisfies Meta<typeof ReportList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A visible and a hidden event; each button asks for the opposite state. */
export const VisibleAndHidden: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: "Feira de Ciências" })).toBeInTheDocument();
    await expect(canvas.getByText(/3 denúncias/)).toBeInTheDocument();
    await expect(canvas.getByText("Spam (2)")).toBeInTheDocument();
    await expect(canvas.getByText("“Parece propaganda”")).toBeInTheDocument();
    await expect(canvas.getByText("Oculto do mural")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Resolver/ })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Ocultar evento Feira de Ciências" }));
    await expect(args.onSetHidden).toHaveBeenCalledWith("evt-1", true);

    await userEvent.click(canvas.getByRole("button", { name: "Reexibir evento Palestra de IA" }));
    await expect(args.onSetHidden).toHaveBeenCalledWith("evt-2", false);

    await expect(canvas.getByRole("link", { name: "Ver evento Feira de Ciências" })).toHaveAttribute("href", "/eventos/evt-1");
    await expect(canvas.queryByRole("link", { name: /Palestra de IA/ })).not.toBeInTheDocument();
  },
};

/** While the visibility of an event changes, its button is disabled. */
export const Changing: Story = {
  args: { busyEventId: "evt-1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Ocultando... Feira de Ciências" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Reexibir evento Palestra de IA" })).toBeEnabled();
  },
};

/** An event that couldn't be loaded: the error shows and no visibility control is offered. */
export const EventNotLoaded: Story = {
  args: {
    items: [{ ...HIDDEN, eventId: "evt-3", event: { kind: "error", message: "A API não devolve este evento." } }],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Evento não carregado" })).toBeInTheDocument();
    await expect(canvas.getByRole("alert")).toHaveTextContent("A API não devolve este evento.");
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** An event deleted by its author: no controls. */
export const DeletedEvent: Story = {
  args: { items: [{ ...FAIR, event: { kind: "loaded", title: "Feira de Ciências", isHidden: false, isDeleted: true } }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Excluído pelo autor")).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** No reports at all. */
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Nenhuma denúncia" })).toBeInTheDocument();
  },
};
