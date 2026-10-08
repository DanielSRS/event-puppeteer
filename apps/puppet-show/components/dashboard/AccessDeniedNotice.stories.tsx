import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { AccessDeniedNotice } from "./AccessDeniedNotice";

const meta = {
  title: "Components/Dashboard/AccessDeniedNotice",
  component: AccessDeniedNotice,
  parameters: { layout: "padded" },
  args: { denial: "role", firstSection: { label: "Meus Eventos", href: "/dashboard/events" } },
  tags: ["autodocs"],
} satisfies Meta<typeof AccessDeniedNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The role is too low (e.g. a moderator opening Auditoria). */
export const RoleTooLow: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Você não tem permissão para acessar esta página.")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Ir para Meus Eventos" })).toHaveAttribute("href", "/dashboard/events");
  },
};

/** A Superadmin in the global context opened an organization page. */
export const NeedsOrganization: Story = {
  args: { denial: "needs-org", firstSection: { label: "Organizações", href: "/dashboard/global/orgs" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Selecione uma organização/)).toBeInTheDocument();
  },
};

/** A Superadmin inside an organization opened a global page. */
export const NeedsGlobal: Story = {
  args: { denial: "needs-global" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/pertence ao Sistema Global/)).toBeInTheDocument();
  },
};

/** No section available: no way-out link. */
export const NoWayOut: Story = {
  args: { firstSection: null },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("link")).not.toBeInTheDocument();
  },
};
