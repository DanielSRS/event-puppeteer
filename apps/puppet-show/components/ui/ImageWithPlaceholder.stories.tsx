import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { ImageWithPlaceholder } from "./ImageWithPlaceholder";
import { APPROVED_BANNER, BANNER_THUMBHASH, PENDING_BANNER } from "./storyImages";

const meta = {
  title: "UI/ImageWithPlaceholder",
  component: ImageWithPlaceholder,
  parameters: { layout: "padded" },
  args: { image: APPROVED_BANNER, alt: "Banner do evento Semana de Tecnologia", className: "aspect-video w-96 rounded-lg" },
} satisfies Meta<typeof ImageWithPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An Image the viewer may see: the picture fades in over its Placeholder. */
export const Approved: Story = {
  play: async ({ canvas }) => {
    const picture = canvas.getByRole("img", { name: "Banner do evento Semana de Tecnologia" });
    await expect(picture.tagName).toBe("IMG");
    await waitFor(() => expect(picture).toHaveClass("opacity-100"));
  },
};

/** An Image not yet Approved: only the blurred Placeholder, still described for screen readers. */
export const PlaceholderOnly: Story = {
  args: { image: PENDING_BANNER },
  play: async ({ canvas }) => {
    const placeholder = canvas.getByRole("img", { name: "Banner do evento Semana de Tecnologia" });
    await expect(placeholder.tagName).toBe("DIV");
    await expect(placeholder.style.backgroundImage).toContain("data:image/png");
  },
};

/** The picture fails to load: the Placeholder stays and the failure is said. */
export const Unavailable: Story = {
  args: { image: { url: "data:image/png;base64,broken", thumbhash: BANNER_THUMBHASH } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("img", { name: /Imagem indisponível no momento/ })).toBeInTheDocument();
    await expect(canvas.getByText("Imagem indisponível no momento.")).toBeInTheDocument();
  },
};
