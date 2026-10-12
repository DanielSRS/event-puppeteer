import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { ScreeningPolicy } from "@/lib/api/schemas";
import { ScreeningPolicyForm } from "./ScreeningPolicyForm";

const cutOffs = { lower: 0.3, upper: 0.8 };
const POLICY: ScreeningPolicy = {
  nudity: { lower: 0.2, upper: 0.7 }, gore: cutOffs, violence: cutOffs, weapons: cutOffs,
  hate: { lower: 0.15, upper: 0.6 }, offensive_gesture: cutOffs, offensive_text: cutOffs,
};

const meta = {
  title: "Dashboard/Global/ScreeningPolicyForm",
  component: ScreeningPolicyForm,
  parameters: { layout: "padded" },
  args: { policy: POLICY, saving: false, error: "", onSave: fn() },
} satisfies Meta<typeof ScreeningPolicyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The policy in force, in percent; a change is saved as fractions. */
export const Edit: Story = {
  args: { onSave: fn() },
  play: async ({ canvas, args }) => {
    const nudityReview = canvas.getAllByLabelText("Revisar a partir de (%)")[0];
    await expect(nudityReview).toHaveValue(20);
    await userEvent.clear(nudityReview);
    await userEvent.type(nudityReview, "10");
    await userEvent.click(canvas.getByRole("button", { name: "Salvar política" }));
    await expect(args.onSave).toHaveBeenCalledWith({ ...POLICY, nudity: { lower: 0.1, upper: 0.7 } });
  },
};

/** No policy yet: every field starts empty and incomplete categories are pointed out. */
export const Unset: Story = {
  args: { policy: null, onSave: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Salvar política" }));
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(canvas.getAllByLabelText("Revisar a partir de (%)")[0]).toHaveAccessibleDescription("Informe os dois limites como números inteiros de 0 a 100.");
  },
};

/** A review cut-off above the rejection one is refused. */
export const Inverted: Story = {
  args: { onSave: fn() },
  play: async ({ canvas, args }) => {
    const hateReview = canvas.getAllByLabelText("Revisar a partir de (%)")[4];
    await userEvent.clear(hateReview);
    await userEvent.type(hateReview, "90");
    await userEvent.click(canvas.getByRole("button", { name: "Salvar política" }));
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(canvas.getByText("O limite de revisão não pode passar o de recusa.")).toBeInTheDocument();
  },
};

/** A refusal from the API is shown under the form. */
export const SaveFailed: Story = {
  args: { error: "Não foi possível salvar a política. Você não tem permissão para fazer isso." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Você não tem permissão");
  },
};
