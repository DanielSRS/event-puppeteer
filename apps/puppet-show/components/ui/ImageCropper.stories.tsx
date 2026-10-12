import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import { BANNER_RULES, LOGO_RULES } from "@/utils/crop";
import { ImageCropper } from "./ImageCropper";
import { PictureFile } from "./storyImages";

const meta = {
  title: "UI/ImageCropper",
  component: ImageCropper,
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
  args: { rules: BANNER_RULES, purpose: "banner do evento", onCropped: fn() },
} satisfies Meta<typeof ImageCropper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Size of the picture handed over by `onCropped`. */
async function SizeOf(picture: unknown) {
  if (!(picture instanceof Blob)) return null;
  const bitmap = await createImageBitmap(picture);
  return { width: bitmap.width, height: bitmap.height };
}

/** A 4:3 photo is cropped to the largest 16:9 area, then handed over as a JPEG of that size. */
export const CropBanner: Story = {
  args: { onCropped: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.upload(canvas.getByLabelText("Escolher imagem para o banner do evento"), await PictureFile(1600, 1200));
    await expect(await canvas.findByRole("img", { name: /Prévia do recorte do banner do evento/ })).toBeInTheDocument();
    await expect(canvas.getByLabelText("Zoom do recorte")).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "Mover o recorte para baixo" }));

    await userEvent.click(canvas.getByRole("button", { name: /Usar este recorte/ }));
    await waitFor(() => expect(args.onCropped).toHaveBeenCalled());
    const picture = (args.onCropped as ReturnType<typeof fn>).mock.calls[0]?.[0];
    await expect(picture).toBeInstanceOf(Blob);
    await expect((picture as Blob).type).toBe("image/jpeg");
    await expect(await SizeOf(picture)).toEqual({ width: 1600, height: 900 });
  },
};

/** A large square logo is scaled down to 512×512. */
export const CropLogo: Story = {
  args: { rules: LOGO_RULES, purpose: "logo da organização", onCropped: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.upload(canvas.getByLabelText("Escolher imagem para o logo da organização"), await PictureFile(1024, 700));
    await userEvent.click(await canvas.findByRole("button", { name: /Usar este recorte/ }));
    await waitFor(() => expect(args.onCropped).toHaveBeenCalled());
    await expect(await SizeOf((args.onCropped as ReturnType<typeof fn>).mock.calls[0]?.[0])).toEqual({ width: 512, height: 512 });
  },
};

/** A picture too small for the minimum is refused before anything is sent. */
export const TooSmall: Story = {
  args: { onCropped: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.upload(canvas.getByLabelText("Escolher imagem para o banner do evento"), await PictureFile(800, 450));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("A imagem é pequena demais: o recorte precisa ter pelo menos 960×540 pixels.");
    await expect(args.onCropped).not.toHaveBeenCalled();
  },
};

/** Changing one's mind goes back to the file picker. */
export const ChooseAnother: Story = {
  play: async ({ canvas }) => {
    await userEvent.upload(canvas.getByLabelText("Escolher imagem para o banner do evento"), await PictureFile(1920, 1080));
    await userEvent.click(await canvas.findByRole("button", { name: /Escolher outra imagem/ }));
    await expect(canvas.getByLabelText("Escolher imagem para o banner do evento")).toBeInTheDocument();
  },
};
