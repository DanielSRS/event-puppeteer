import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { WakeupResentNotice } from "./WakeupResentNotice";

const meta = {
  title: "Dashboard/Devices/WakeupResentNotice",
  component: WakeupResentNotice,
  parameters: { layout: "padded" },
  args: { commandLabel: "Reiniciar", wakeup: { sent: true } },
} satisfies Meta<typeof WakeupResentNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Wake-up was sent again: the Device is told to fetch the Command now. */
export const WakeupSent: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Aviso reenviado para o comando “Reiniciar”. O dispositivo foi avisado");
  },
};

/** The Wake-up failed again: the person learns why and that the heartbeat delay (up to 20 s) applies. */
export const WakeupFailed: Story = {
  args: { wakeup: { sent: false, reason: "connack timeout" } },
  play: async ({ canvas }) => {
    const notice = canvas.getByRole("status");
    await expect(notice).toHaveTextContent("falhou de novo (connack timeout)");
    await expect(notice).toHaveTextContent("próximo heartbeat, em até 20 s");
  },
};
