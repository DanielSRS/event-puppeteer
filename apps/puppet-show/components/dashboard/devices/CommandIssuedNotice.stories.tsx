import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { CommandIssuedNotice } from "./CommandIssuedNotice";

const meta = {
  title: "Dashboard/Devices/CommandIssuedNotice",
  component: CommandIssuedNotice,
  parameters: { layout: "padded" },
  args: { commandLabel: "Reiniciar", wakeup: { sent: true } },
} satisfies Meta<typeof CommandIssuedNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Wake-up was sent: the Device is told to fetch the Command now. */
export const WakeupSent: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Comando “Reiniciar” enviado. O dispositivo foi avisado e o recebe em instantes.");
  },
};

/** The Wake-up failed: the person learns why and that the heartbeat delay (up to 20 s) applies. */
export const WakeupFailed: Story = {
  args: { wakeup: { sent: false, reason: "connack timeout" } },
  play: async ({ canvas }) => {
    const notice = canvas.getByRole("status");
    await expect(notice).toHaveTextContent("o aviso ao dispositivo falhou (connack timeout)");
    await expect(notice).toHaveTextContent("próximo heartbeat, em até 20 s");
  },
};
