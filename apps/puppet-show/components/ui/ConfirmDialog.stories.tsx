import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { ConfirmDialog } from "./ConfirmDialog";

/** Confirmation for actions that are hard to undo. */
const meta = {
  title: "Components/UI/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  args: {
    isOpen: true,
    title: "Excluir este evento?",
    children: "O evento sai do mural e dos totens. Esta ação não pode ser desfeita.",
    confirmLabel: "Sim, excluir",
    danger: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Cancel has the initial focus, so Enter never confirms by accident. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const dialog = doc.querySelector('dialog[role="alertdialog"]');
    await expect(dialog).toHaveAccessibleName("Excluir este evento?");
    await expect(doc.activeElement).toHaveTextContent("Cancelar");

    const confirm = Array.from(doc.querySelectorAll("button")).find((b) => b.textContent === "Sim, excluir");
    if (confirm === undefined) throw new Error("confirm button not rendered");
    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

/**
 * Escape: dispatches the `cancel` event the browser sends, since synthetic key
 * events don't trigger native dialog behaviour (the real key is covered end-to-end).
 * Escape (the dialog's cancel event) cancels. */
export const EscapeCancels: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = canvasElement.ownerDocument.querySelector("dialog");
    if (dialog === null) throw new Error("dialog not rendered");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};

/** While the action runs, both buttons are disabled. */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.ownerDocument.querySelectorAll("dialog button");
    for (const button of Array.from(buttons)) await expect(button).toBeDisabled();
  },
};

/** A failed attempt is explained inside the dialog. */
export const Failed: Story = {
  args: { error: "Você não tem permissão para fazer isso." },
  play: async ({ canvasElement }) => {
    const alert = canvasElement.ownerDocument.querySelector('dialog [role="alert"]');
    await expect(alert).toHaveTextContent("Você não tem permissão");
  },
};
