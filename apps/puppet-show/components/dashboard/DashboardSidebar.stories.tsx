import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { DashboardSidebar } from "./DashboardSidebar";

const ORGS = [
  { id: "org-a", name: "Universidade Estadual" },
  { id: "org-b", name: "Outra Organização" },
];

const meta = {
  title: "Components/Dashboard/DashboardSidebar",
  component: DashboardSidebar,
  parameters: { layout: "padded" },
  args: {
    role: "Member",
    orgId: "org-a",
    contextName: "Universidade Estadual",
    organizations: [ORGS[0]],
    pathname: "/dashboard/events",
    onSelectOrg: fn(),
  },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-64"><Story /></div>],
} satisfies Meta<typeof DashboardSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Labels of the section links, in order. */
function Sections(canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"]): string[] {
  return canvas.getAllByRole("link").map((link) => link.textContent ?? "");
}

export const Member: Story = {
  play: async ({ canvas }) => {
    await expect(Sections(canvas)).toEqual(["Meus Eventos"]);
    await expect(canvas.getByRole("link", { name: "Meus Eventos" })).toHaveAttribute("aria-current", "page");
  },
};

export const Moderator: Story = {
  args: { role: "Moderator", pathname: "/dashboard/reports" },
  play: async ({ canvas }) => {
    await expect(Sections(canvas)).toEqual(["Meus Eventos", "Denúncias", "Usuários Banidos", "Tags Sugeridas"]);
    await expect(canvas.getByRole("link", { name: "Denúncias" })).toHaveAttribute("aria-current", "page");
  },
};

export const Admin: Story = {
  args: { role: "Admin", pathname: "/dashboard/devices/abc" },
  play: async ({ canvas }) => {
    await expect(Sections(canvas)).toEqual([
      "Meus Eventos", "Denúncias", "Usuários Banidos", "Tags Sugeridas", "Auditoria", "Usuários", "Dispositivos", "Configurações",
    ]);
    await expect(canvas.getByRole("link", { name: "Dispositivos" })).toHaveAttribute("aria-current", "page");
  },
};

export const SuperadminGlobal: Story = {
  args: { role: "Superadmin", orgId: null, contextName: "Sistema Global", organizations: ORGS, pathname: "/dashboard/global/orgs" },
  play: async ({ canvas }) => {
    await expect(Sections(canvas)).toEqual(["Organizações", "Dispositivos Órfãos", "Tags Globais", "Links Globais"]);
    await expect(canvas.getByRole("button", { name: /Sistema Global/ })).toHaveAttribute("aria-expanded", "false");
  },
};

export const SuperadminInOrganization: Story = {
  args: { role: "Superadmin", orgId: "org-a", organizations: ORGS, pathname: "/dashboard/settings" },
  play: async ({ canvas }) => {
    await expect(Sections(canvas)).toEqual([
      "Meus Eventos", "Denúncias", "Usuários Banidos", "Tags Sugeridas", "Auditoria", "Usuários", "Dispositivos", "Configurações",
    ]);
  },
};
