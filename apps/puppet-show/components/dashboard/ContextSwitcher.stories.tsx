import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ContextSwitcher } from "./ContextSwitcher";

const ORGS = [
  { id: "org-a", name: "Universidade Estadual" },
  { id: "org-b", name: "Outra Organização" },
];

const meta = {
  title: "Components/Dashboard/ContextSwitcher",
  component: ContextSwitcher,
  parameters: { layout: "padded" },
  args: {
    organizations: ORGS,
    currentOrgId: null,
    contextName: "Sistema Global",
    canSwitch: true,
    onSelect: fn(),
  },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-64 min-h-72"><Story /></div>],
} satisfies Meta<typeof ContextSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Superadmin, closed, in the global context. */
export const Closed: Story = {
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: /Sistema Global/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("list", { name: "Contextos disponíveis" })).not.toBeInTheDocument();
  },
};

/** Opened with a click: every context is listed and the current one is marked. */
export const Open: Story = {
  args: { onSelect: fn() },
  play: async ({ args, canvas }) => {
    const toggle = canvas.getByRole("button", { name: /Sistema Global/ });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const list = canvas.getByRole("list", { name: "Contextos disponíveis" });
    await expect(toggle).toHaveAttribute("aria-controls", list.id);
    await expect(canvas.getAllByRole("button", { current: true })).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", { name: "Universidade Estadual" }));
    await expect(args.onSelect).toHaveBeenCalledWith("org-a");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  },
};

/** Keyboard only: Enter opens, Tab reaches the options, Escape closes and returns focus. */
export const Keyboard: Story = {
  args: { onSelect: fn(), currentOrgId: "org-a", contextName: "Universidade Estadual" },
  play: async ({ args, canvas }) => {
    await userEvent.tab();
    const toggle = canvas.getByRole("button", { name: /Universidade Estadual/ });
    await expect(toggle).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("button", { name: "Universidade Estadual", current: true })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Sistema Global" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledWith(null);
    await expect(toggle).toHaveFocus();
  },
};

/** A click outside closes the list without choosing. */
export const OutsideClickCloses: Story = {
  args: { onSelect: fn() },
  play: async ({ args, canvas, canvasElement }) => {
    const toggle = canvas.getByRole("button", { name: /Sistema Global/ });
    await userEvent.click(toggle);
    await userEvent.click(canvasElement.ownerDocument.body);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

/** Members, moderators and admins only see their own organization. */
export const OwnOrganization: Story = {
  args: { canSwitch: false, currentOrgId: "org-a", contextName: "Universidade Estadual", organizations: [ORGS[0]] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Universidade Estadual")).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
