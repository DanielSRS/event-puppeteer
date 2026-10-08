import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { Drawer } from "./Drawer";

/** Modal side panel used by every form in the app. */
const meta = {
  title: "Components/UI/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  args: {
    isOpen: true,
    title: "Nova organização",
    onClose: fn(),
    children: <label className="column">Nome<input className="input" /></label>,
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open: it is a named dialog and the close button asks to close it. */
export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const body = canvasElement.ownerDocument.body;
    const dialog = body.querySelector("dialog");
    await expect(dialog).toHaveAttribute("open");
    await expect(dialog).toHaveAccessibleName("Nova organização");

    const close = body.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
    if (close === null) throw new Error("close button not rendered");
    await userEvent.click(close);
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

/**
 * Escape: dispatches the `cancel` event the browser sends, since synthetic key
 * events don't trigger native dialog behaviour (the real key is covered end-to-end).
 * Escape (the dialog's cancel event) asks to close it; the parent decides whether it really closes. */
export const EscapeCloses: Story = {
  play: async ({ args, canvasElement }) => {
    const dialog = canvasElement.ownerDocument.querySelector("dialog");
    if (dialog === null) throw new Error("dialog not rendered");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

/** Closed: nothing is shown. */
export const Closed: Story = {
  args: { isOpen: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.body.querySelector("dialog")).not.toHaveAttribute("open");
  },
};
