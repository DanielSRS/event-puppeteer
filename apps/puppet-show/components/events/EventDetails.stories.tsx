import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { EventDetail } from "@/lib/api/mappers";
import { EventDetails } from "./EventDetails";
import { APPROVED_BANNER, PENDING_BANNER } from "@/components/ui/storyImages";

const EVENT: EventDetail = {
  id: "evt-1",
  organizationId: "org-1",
  creatorId: "user-9",
  title: "Semana de Tecnologia",
  description: "Palestras, minicursos e hackathon.\nAberto a toda a comunidade.",
  location: "Auditório Central, Módulo 2",
  coordinates: null,
  banner: null,
  isHidden: false,
  schedule: [
    { date: "2026-10-15", startTime: "08:00", endTime: "12:00" },
    { date: "2026-10-16" },
    { date: "2026-10-17", startTime: "19:00" },
  ],
  tags: [{ id: "t1", name: "Tecnologia" }],
  links: [
    { label: "Inscrição", url: "https://example.org/inscricao" },
    { label: "Instagram", url: "https://example.org/insta" },
    { label: "Mais informações", url: "https://example.org/info" },
  ],
};

/** Everything about one event, with the actions people can take. */
const meta = {
  title: "Components/Events/EventDetails",
  component: EventDetails,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    event: EVENT,
    likes: { voted: false, count: 3 },
    canModerate: false,
    isCreator: false,
    canDelete: false,
    reported: false,
    loginPrompt: null,
    loginRedirect: "/eventos/evt-1",
    notice: "",
    error: "",
    onToggleLike: fn(),
    onShare: fn(),
    onReport: fn(),
    onHide: fn(),
    onUnhide: fn(),
    onDelete: fn(),
    bannerBusy: false,
    onReplaceBanner: fn(),
    onRemoveBanner: fn(),
  },
} satisfies Meta<typeof EventDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A member: schedule day by day, links as buttons, like, share and report. */
export const Member: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: "Semana de Tecnologia" })).toBeInTheDocument();
    await expect(canvas.getByText("08:00 – 12:00")).toBeInTheDocument();
    await expect(canvas.getByText("Dia todo")).toBeInTheDocument();
    await expect(canvas.getByText("A partir das 19:00")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /Inscrição/ })).toHaveAttribute("href", "https://example.org/inscricao");
    await expect(canvas.queryByRole("button", { name: /Ocultar/ })).toBeNull();
    await expect(canvas.queryByRole("button", { name: /Excluir/ })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Curtir/ }));
    await expect(args.onToggleLike).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Compartilhar" }));
    await expect(args.onShare).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Denunciar" }));
    await expect(args.onReport).toHaveBeenCalled();
  },
};

/** With coordinates: OpenStreetMap embed and "Abrir no mapa"; with a banner. */
export const WithMapAndBanner: Story = {
  args: {
    event: {
      ...EVENT,
      coordinates: { latitude: -12.2, longitude: -38.97 },
      banner: APPROVED_BANNER,
    },
  },
  play: async ({ canvasElement, canvas }) => {
    const frame = canvasElement.querySelector("iframe");
    await expect(frame).toHaveAttribute("title", "Mapa: Auditório Central, Módulo 2");
    await expect(frame?.getAttribute("src")).toContain("marker=-12.2,-38.97");
    await expect(canvas.getByRole("link", { name: /Abrir no mapa/ })).toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: "Banner do evento Semana de Tecnologia" })).toBeInTheDocument();
  },
};

/** A banner not yet Approved: only its blurred Placeholder shows. */
export const PendingBanner: Story = {
  args: { event: { ...EVENT, banner: PENDING_BANNER } },
  play: async ({ canvas }) => {
    const banner = canvas.getByRole("img", { name: "Banner do evento Semana de Tecnologia" });
    await expect(banner.tagName).toBe("DIV");
    await expect(banner.style.backgroundImage).toContain("data:image/png");
  },
};

/** The creator: "Excluir", no report. */
export const Creator: Story = {
  args: { isCreator: true, canDelete: true },
  play: async ({ canvas, args }) => {
    await expect(canvas.queryByRole("button", { name: "Denunciar" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Excluir" }));
    await expect(args.onDelete).toHaveBeenCalled();
  },
};

/** A Superadmin who did not create the event: "Excluir" and "Denunciar" both show. */
export const SuperadminNotCreator: Story = {
  args: { canModerate: true, canDelete: true },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("button", { name: "Denunciar" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Excluir" }));
    await expect(args.onDelete).toHaveBeenCalled();
  },
};

/** The creator of an event with a banner can remove it, or pick another one to crop. */
export const CreatorWithBanner: Story = {
  args: { isCreator: true, canDelete: true, event: { ...EVENT, banner: APPROVED_BANNER } },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByText("Trocar ou remover o banner"));
    await expect(canvas.getByLabelText("Escolher imagem para o banner do evento")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Remover banner" }));
    await expect(args.onRemoveBanner).toHaveBeenCalled();
  },
};

/** A moderator can hide it. */
export const Moderator: Story = {
  args: { canModerate: true },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Ocultar evento" }));
    await expect(args.onHide).toHaveBeenCalled();
  },
};

/** Hidden by moderation, seen by a moderator: notice and "Reexibir". */
export const HiddenForModerator: Story = {
  args: { canModerate: true, event: { ...EVENT, isHidden: true } },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/Oculto pela moderação/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reexibir evento" }));
    await expect(args.onUnhide).toHaveBeenCalled();
  },
};

/** Anonymous visitor tried to like. */
export const LoginPrompt: Story = {
  args: { loginPrompt: "curtir" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar?redirect=%2Feventos%2Fevt-1");
  },
};

/** Already reported, with the API's refusal shown. */
export const AlreadyReported: Story = {
  args: { reported: true, error: "Você já denunciou este evento." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Denunciado" })).toBeDisabled();
    await expect(canvas.getByRole("alert")).toHaveTextContent("Você já denunciou este evento.");
  },
};

/** A confirmation after an action, and a link whose label isn't in the catalog. */
export const NoticeAndUnknownLabel: Story = {
  args: {
    notice: "Link do evento copiado para a área de transferência.",
    event: { ...EVENT, links: [{ label: null, url: "https://example.org/x" }] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Link do evento copiado");
    await expect(canvas.getByRole("link", { name: /https:\/\/example.org\/x/ })).toBeInTheDocument();
  },
};
