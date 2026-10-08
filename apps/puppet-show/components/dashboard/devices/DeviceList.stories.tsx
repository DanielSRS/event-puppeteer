import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { Device } from "@/lib/api/schemas";
import { Err, Ok } from "@/lib/result";
import { DeviceList } from "./DeviceList";

const PENDING: Device = { id: "d1", identifier: "pending-mac-02", status: "pending", organizationId: "o1", connectedAt: "2026-10-07T12:00:00Z" };
const LIBRARY: Device = {
  id: "d2", identifier: "active-mac-03", name: "Totem Biblioteca", location: "Biblioteca Central", status: "active",
  organizationId: "o1", connectedAt: "2026-10-01T12:00:00Z",
};
const CAFE: Device = { ...LIBRARY, id: "d3", identifier: "active-mac-04", name: "Totem Refeitório", location: "Refeitório" };

const meta = {
  title: "Dashboard/Devices/DeviceList",
  component: DeviceList,
  parameters: { layout: "padded" },
  args: {
    pending: [PENDING],
    active: [
      { device: LIBRARY, status: Ok({ isOnline: true, latestHeartbeat: { deviceId: "d2", timestamp: "2026-10-07T15:00:00Z", status: "ok" } }) },
      { device: CAFE, status: Ok({ isOnline: false, latestHeartbeat: null }) },
    ],
    busyDeviceId: null,
    onApprove: fn(),
    onReject: fn(),
  },
} satisfies Meta<typeof DeviceList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pending devices can be approved or rejected; active ones show status and identifier. */
export const Default: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Aprovar pending-mac-02" }));
    await expect(args.onApprove).toHaveBeenCalledWith(PENDING);
    await userEvent.click(canvas.getByRole("button", { name: "Rejeitar pending-mac-02" }));
    await expect(args.onReject).toHaveBeenCalledWith(PENDING);

    await expect(canvas.getByText("Online")).toBeInTheDocument();
    await expect(canvas.getByText("Offline")).toBeInTheDocument();
    await expect(canvas.getByText("Último sinal: 07/10/2026, 12:00")).toBeInTheDocument();
    await expect(canvas.getByText("Nenhum sinal recebido ainda")).toBeInTheDocument();
    await expect(canvas.getByText("active-mac-03")).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Ver detalhes de Totem Biblioteca" })).toHaveAttribute("href", "/dashboard/devices/d2");
  },
};

/** A device whose status couldn't be read says so. */
export const StatusUnavailable: Story = {
  args: { pending: [], active: [{ device: LIBRARY, status: Err("Status indisponível. O servidor encontrou um erro.") }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Status indisponível/)).toHaveClass("text-danger");
    await expect(canvas.queryByText("Online")).not.toBeInTheDocument();
  },
};

/** While a pending device is handled, its buttons are disabled. */
export const Busy: Story = {
  args: { busyDeviceId: "d1" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Aprovar pending-mac-02" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Rejeitar pending-mac-02" })).toBeDisabled();
  },
};

/** No devices at all. */
export const Empty: Story = {
  args: { pending: [], active: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhum dispositivo aguardando aprovação.")).toBeInTheDocument();
    await expect(canvas.getByText("Nenhum dispositivo ativo.")).toBeInTheDocument();
  },
};
