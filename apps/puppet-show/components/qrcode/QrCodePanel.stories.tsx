import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Ok } from "@/lib/result";
import { QrCodePanel } from "./QrCodePanel";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>';

/** The site's QR code for big screens. */
const meta = {
  title: "Components/QrCode/QrCodePanel",
  component: QrCodePanel,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { qr: Ok({ url: "https://mural.example.org", svg: SVG }) },
} satisfies Meta<typeof QrCodePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Side: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: "QR Code para https://mural.example.org" })).toBeInTheDocument();
  },
};

export const Tv: Story = { args: { variant: "tv" } };

/** No site address configured: says what to set instead of a made-up code. */
export const MissingSiteUrl: Story = {
  args: { qr: { ok: false, error: "Endereço do site não configurado: defina NEXT_PUBLIC_SITE_URL para exibir o QR Code." } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("NEXT_PUBLIC_SITE_URL");
    await expect(canvas.queryByRole("img")).toBeNull();
  },
};
