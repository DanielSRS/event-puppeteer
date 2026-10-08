import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { Organization } from "@/lib/api/schemas";
import { OrgManager } from "./OrgManager";

const UEFS: Organization = {
  id: "o1", name: "Universidade Estadual", slug: "uefs", description: "Mural do campus.", url: "https://uefs.br",
  colorScheme: "#2563eb", location: "Feira de Santana, BA", latitude: -12.2, longitude: -38.97, shadowBanThreshold: 5,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

const BARE: Organization = {
  id: "o2", name: "Outra Organização", slug: "outra", shadowBanThreshold: 3,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

const meta = {
  title: "Dashboard/Global/OrgManager",
  component: OrgManager,
  parameters: { layout: "padded" },
  args: { organizations: [UEFS, BARE], onCreate: fn(), onEdit: fn() },
} satisfies Meta<typeof OrgManager>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each card has a labelled edit button; absent fields say so. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText("Não informadas")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Editar Outra Organização" }));
    await expect(args.onEdit).toHaveBeenCalledWith(BARE);
    await userEvent.click(canvas.getByRole("button", { name: "Nova organização" }));
    await expect(args.onCreate).toHaveBeenCalled();
  },
};

/** No organizations yet. */
export const Empty: Story = {
  args: { organizations: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhuma organização cadastrada.")).toBeInTheDocument();
  },
};
