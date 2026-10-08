import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import { NameCatalog } from "./NameCatalog";

const meta = {
  title: "Dashboard/Global/NameCatalog",
  component: NameCatalog,
  parameters: { layout: "padded" },
  args: {
    title: "Tags oficiais",
    inputLabel: "Nome da nova tag",
    placeholder: "Ex.: Esportes",
    submitLabel: "Criar tag",
    emptyText: "Nenhuma tag oficial ainda.",
    items: [{ id: "t1", name: "Tecnologia" }, { id: "t2", name: "Cultura" }],
    saving: false,
    error: "",
    onCreate: fn(async () => true),
  },
} satisfies Meta<typeof NameCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Creating trims the name and clears the input when it worked. */
export const Create: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole("heading", { name: "Tags oficiais (2)" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Remover|Excluir/ })).not.toBeInTheDocument();
    const input = canvas.getByLabelText("Nome da nova tag");
    await userEvent.type(input, "  Esportes ");
    await userEvent.click(canvas.getByRole("button", { name: "Criar tag" }));
    await expect(args.onCreate).toHaveBeenCalledWith("Esportes");
    await expect(input).toHaveValue("");
  },
};

/** A blank name is refused before reaching the API. */
export const BlankName: Story = {
  args: { onCreate: fn(async () => true) },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Criar tag" }));
    await expect(args.onCreate).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Nome da nova tag")).toHaveAccessibleDescription("Informe um nome.");
  },
};

/** A refused creation keeps what was typed and shows why. */
export const Duplicate: Story = {
  args: { onCreate: fn(async () => false), error: "Já existe uma tag com esse nome." },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText("Nome da nova tag");
    await userEvent.type(input, "tecnologia");
    await userEvent.click(canvas.getByRole("button", { name: "Criar tag" }));
    await expect(input).toHaveValue("tecnologia");
    await expect(canvas.getByRole("alert")).toHaveTextContent("Já existe uma tag com esse nome.");
  },
};

/** While saving the form is disabled. */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Criando..." })).toBeDisabled();
  },
};

/** Nothing registered. */
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Nenhuma tag oficial ainda.")).toBeInTheDocument();
  },
};
