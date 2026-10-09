import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ErrorAlert } from "@/components/ui/Feedback";
import { DashboardLayout } from "./DashboardLayout";

const meta = {
  title: "Components/Dashboard/DashboardLayout",
  component: DashboardLayout,
  parameters: { layout: "fullscreen" },
  args: {
    role: "Admin",
    orgId: "org-a",
    contextName: "Universidade Estadual",
    organizations: [{ id: "org-a", name: "Universidade Estadual" }],
    pathname: "/dashboard/events",
    onSelectOrg: fn(),
    children: <h1 className="title">Meus Eventos</h1>,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop: sidebar plus the context named in the header; the phone top bar stays hidden. */
export const Desktop: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("navigation", { name: "Seções do painel" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Seções" })).not.toBeInTheDocument();
    await expect(canvas.getByText("Gerenciando:")).toBeInTheDocument();
  },
};

/** A notice from the shell, e.g. the context can't be remembered. */
export const WithNotice: Story = {
  args: {
    role: "Superadmin",
    orgId: null,
    contextName: "Sistema Global",
    pathname: "/dashboard/global/orgs",
    notices: <ErrorAlert>O navegador bloqueou o armazenamento local: o contexto escolhido não será lembrado ao recarregar a página.</ErrorAlert>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(/não será lembrado/);
  },
};

/** Phone: the sidebar becomes a top bar whose Seções button opens the navigation. */
export const Phone: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvas, canvasElement }) => {
    const menu = canvas.getByRole("button", { name: "Seções" });
    await expect(canvas.queryByRole("navigation", { name: "Seções do painel" })).not.toBeInTheDocument();
    await userEvent.click(menu);
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog", { name: "Menu do painel" });
    await expect(within(dialog).getByRole("link", { name: "Configurações" })).toBeVisible();
  },
};
