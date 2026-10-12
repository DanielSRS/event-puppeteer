import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { LOGO_THUMBHASH, LOGO_URL } from "@/components/ui/storyImages";
import { LogoPanel } from "./LogoPanel";

const meta = {
  title: "Dashboard/Settings/LogoPanel",
  component: LogoPanel,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
  args: {
    orgName: "Universidade Estadual",
    logo: { url: LOGO_URL, thumbhash: LOGO_THUMBHASH },
    busy: false,
    notice: "",
    error: "",
    onUpload: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof LogoPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The current logo can be removed, or a new square one picked and cropped. */
export const WithLogo: Story = {
  args: { onRemove: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("img", { name: "Logo de Universidade Estadual" })).toBeInTheDocument();
    await expect(canvas.getByLabelText("Escolher imagem para o logo da organização")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Remover logo" }));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};

/** No logo yet. */
export const WithoutLogo: Story = {
  args: { logo: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("A organização ainda não tem logo.")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Remover logo" })).not.toBeInTheDocument();
  },
};

/** The outcome of the last change is said. */
export const Failed: Story = {
  args: { error: "Não foi possível enviar o logo. A imagem não está na proporção exigida. Recorte-a antes de enviar." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("proporção exigida");
  },
};
