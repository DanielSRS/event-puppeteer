import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { ImageReviewItem } from "@/lib/api/schemas";
import { BANNER_THUMBHASH, BANNER_URL, LOGO_THUMBHASH, LOGO_URL } from "@/components/ui/storyImages";
import { ImageReviewList } from "./ImageReviewList";

const BANNER: ImageReviewItem = {
  id: "img-1",
  kind: "event_banner",
  ownerId: "evt-1",
  ownerName: "Semana de Tecnologia",
  organizationId: "org-1",
  uploaderId: "u-1",
  uploaderName: "João Silva",
  uploadedAt: "2026-10-11T15:04:00.000Z",
  notScreened: false,
  scores: { weapons: 0.62, violence: 0.31, nudity: 0.004 },
  previewUrl: BANNER_URL,
  thumbhash: BANNER_THUMBHASH,
};

const LOGO: ImageReviewItem = {
  ...BANNER,
  id: "img-2",
  kind: "organization_logo",
  ownerId: "org-1",
  ownerName: "Universidade Estadual",
  uploaderName: "Maria Souza",
  notScreened: true,
  unscreenedReason: "OpenAI unreachable: fetch failed",
  scores: { offensive_gesture: 0.4 },
  previewUrl: LOGO_URL,
  thumbhash: LOGO_THUMBHASH,
};

const meta = {
  title: "Dashboard/Images/ImageReviewList",
  component: ImageReviewList,
  parameters: { layout: "padded" },
  args: { items: [BANNER, LOGO], busyId: null, onApprove: fn(), onReject: fn() },
} satisfies Meta<typeof ImageReviewList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each Image says what was suspected before its picture is revealed; approve and reject are per Image. */
export const Default: Story = {
  args: { onApprove: fn(), onReject: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: "Aguardando revisão (2)" })).toBeInTheDocument();
    const suspicions = canvas.getByRole("list", { name: "Suspeitas: Banner do evento “Semana de Tecnologia”" });
    await expect(suspicions).toHaveTextContent("Armas: 62%");
    await expect(suspicions).toHaveTextContent("Violência: 31%");
    await expect(suspicions).not.toHaveTextContent("Nudez");
    await expect(canvas.getByText(/Não analisada automaticamente/)).toBeInTheDocument();
    await expect(canvas.getByText("Motivo técnico: OpenAI unreachable: fetch failed")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Suspeitas: Logo da organização Universidade Estadual" })).toHaveTextContent("Gestos ofensivos: 40%");

    await expect(canvas.getByRole("img", { name: "Banner do evento “Semana de Tecnologia” (oculta até ser revelada)" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Revelar imagem Banner do evento “Semana de Tecnologia”" }));
    await expect(await canvas.findByRole("img", { name: "Banner do evento “Semana de Tecnologia”" })).toHaveAttribute("src", BANNER_URL);

    await userEvent.click(canvas.getByRole("button", { name: "Aprovar Banner do evento “Semana de Tecnologia”" }));
    await expect(args.onApprove).toHaveBeenCalledWith(BANNER);
    await userEvent.click(canvas.getByRole("button", { name: "Rejeitar Logo da organização Universidade Estadual" }));
    await expect(args.onReject).toHaveBeenCalledWith(LOGO);
  },
};

/** While a decision is being sent, that Image's buttons are disabled. */
export const Deciding: Story = {
  args: { busyId: "img-1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Aprovar Banner do evento “Semana de Tecnologia”" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Aprovar Logo da organização Universidade Estadual" })).toBeEnabled();
  },
};

/** The Superadmin's queue names each Image's organization. */
export const WithOrganizations: Story = {
  args: { items: [BANNER], organizationNames: new Map([["org-1", "Universidade Estadual"]]) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/João Silva em .* · Universidade Estadual/)).toBeInTheDocument();
  },
};

/** Nothing to review. */
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Nenhuma imagem aguardando revisão" })).toBeInTheDocument();
  },
};
