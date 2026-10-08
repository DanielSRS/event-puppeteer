import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { User } from "@/lib/api/schemas";
import { UserList } from "./UserList";

/** A person of the organization. */
function person(id: string, firstName: string, lastName: string, role: "Admin" | "Moderator" | "Member", isShadowBanned = false): User {
  return {
    id, firstName, lastName, role, isShadowBanned,
    normalizedName: `${firstName} ${lastName}`.toLowerCase(),
    email: `${firstName.toLowerCase()}@uefs.br`,
    organizationId: "org-1",
  };
}

const ANA = person("u1", "Ana", "Admin", "Admin");
const MARCOS = person("u2", "Marcos", "Moderador", "Moderator");
const MARIA = person("u3", "Maria", "Membro", "Member", true);

const meta = {
  title: "Dashboard/Users/UserList",
  component: UserList,
  parameters: { layout: "padded" },
  args: {
    users: [ANA, MARCOS, MARIA],
    currentUserId: "u1",
    busyUserId: null,
    onChangeRole: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof UserList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Roles change through a labelled select; removal is asked per person. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText("Em shadow ban")).toBeInTheDocument();

    await userEvent.selectOptions(canvas.getByLabelText("Papel de Marcos Moderador"), "Admin");
    await expect(args.onChangeRole).toHaveBeenCalledWith(MARCOS, "Admin");

    await userEvent.click(canvas.getByRole("button", { name: "Remover Maria Membro" }));
    await expect(args.onRemove).toHaveBeenCalledWith(MARIA);
  },
};

/** The logged-in person can't demote or remove themselves, and is told why. */
export const SelfControlsDisabled: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Papel de Ana Admin")).toBeDisabled();
    const remove = canvas.getByRole("button", { name: "Remover Ana Admin" });
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAccessibleDescription("Você não pode alterar o próprio papel nem remover a própria conta.");
  },
};

/** While a change is saved, that person's controls are disabled. */
export const Saving: Story = {
  args: { busyUserId: "u2" },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Papel de Marcos Moderador")).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Remover Marcos Moderador" })).toBeDisabled();
    await expect(canvas.getByLabelText("Papel de Maria Membro")).toBeEnabled();
  },
};
