import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { Device } from "@/lib/api/schemas";
import { OrphanDeviceList } from "./OrphanDeviceList";

const ORPHAN: Device = { id: "d1", identifier: "orphan-mac-01", status: "pending", connectedAt: "2026-10-07T12:00:00Z" };
const NO_IDENTIFIER: Device = { id: "d9", status: "pending", connectedAt: "2026-10-06T12:00:00Z" };

const meta = {
  title: "Dashboard/Global/OrphanDeviceList",
  component: OrphanDeviceList,
  parameters: { layout: "padded" },
  args: { devices: [ORPHAN, NO_IDENTIFIER], busyDeviceId: null, onAssign: fn(), onReject: fn() },
} satisfies Meta<typeof OrphanDeviceList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Each device shows its identifier and can be assigned or rejected. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: "sem identificador (id d9)" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Atribuir a uma organização (orphan-mac-01)" }));
    await expect(args.onAssign).toHaveBeenCalledWith(ORPHAN);
    await userEvent.click(canvas.getByRole("button", { name: "Rejeitar orphan-mac-01" }));
    await expect(args.onReject).toHaveBeenCalledWith(ORPHAN);
  },
};

/** The device being handled has its buttons disabled. */
export const Busy: Story = {
  args: { busyDeviceId: "d1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Rejeitar orphan-mac-01" })).toBeDisabled();
  },
};

/** No orphans. */
export const Empty: Story = {
  args: { devices: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Nenhum dispositivo órfão" })).toBeInTheDocument();
  },
};
