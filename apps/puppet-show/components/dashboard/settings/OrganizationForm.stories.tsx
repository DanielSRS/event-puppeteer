import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent } from "storybook/test";
import type { Organization } from "@/lib/api/schemas";
import { OrganizationForm } from "./OrganizationForm";

const ORG: Organization = {
  id: "o1", name: "Universidade Estadual", slug: "uefs", description: "Mural de eventos do campus.",
  url: "https://uefs.br", colorScheme: "#2563eb", location: "Feira de Santana, BA", latitude: -12.2, longitude: -38.97,
  shadowBanThreshold: 5, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

const meta = {
  title: "Dashboard/Settings/OrganizationForm",
  component: OrganizationForm,
  parameters: { layout: "padded" },
  args: {
    mode: "create",
    onCreate: fn(),
    saving: false,
    error: "",
    takenSlugs: ["outra"],
    slugEditable: true,
    onCancel: fn(),
  },
} satisfies Meta<typeof OrganizationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Args of a story that edits an existing organization, each with its own update spy. */
function EditArgs() {
  return { mode: "edit", original: ORG, onUpdate: fn(), slugEditable: false, takenSlugs: [] } as const;
}

/** The create callback of a story set up in create mode (the props are a union by `mode`). */
function CreateSpy(args: Story["args"]) {
  if (args === undefined || args.mode !== "create") throw new Error("story is not in create mode");
  return args.onCreate;
}

/** The update callback of a story set up in edit mode. */
function UpdateSpy(args: Story["args"]) {
  if (args === undefined || args.mode !== "edit") throw new Error("story is not in edit mode");
  return args.onUpdate;
}

/** Creating: the slug follows the name; every field reaches the API body. */
export const Create: Story = {
  args: { mode: "create", onCreate: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText("Nome"), "Instituto Federal");
    await expect(canvas.getByLabelText("Identificador (slug)")).toHaveValue("instituto-federal");
    await userEvent.type(canvas.getByLabelText("Descrição (opcional)"), "Campus central");
    await userEvent.type(canvas.getByLabelText("Site (opcional)"), "https://if.edu.br");
    await userEvent.type(canvas.getByLabelText("Cor principal (opcional)"), "#16a34a");
    await userEvent.type(canvas.getByLabelText("Local (opcional)"), "Salvador");
    await userEvent.type(canvas.getByLabelText("Latitude (opcional)"), "-12,97");
    await userEvent.type(canvas.getByLabelText("Longitude (opcional)"), "-38.5");
    await userEvent.clear(canvas.getByLabelText("Limite de denúncias"));
    await userEvent.type(canvas.getByLabelText("Limite de denúncias"), "3");
    await userEvent.click(canvas.getByRole("button", { name: "Criar organização" }));
    await expect(CreateSpy(args)).toHaveBeenCalledWith({
      name: "Instituto Federal", slug: "instituto-federal", description: "Campus central", url: "https://if.edu.br",
      colorScheme: "#16a34a", location: "Salvador", latitude: -12.97, longitude: -38.5, shadowBanThreshold: 3,
    });
  },
};

/** Invalid values are pointed out on each field and nothing is sent. */
export const ValidationErrors: Story = {
  args: { mode: "create", onCreate: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByLabelText("Nome"), "Outra");
    await userEvent.type(canvas.getByLabelText("Endereço do logo (opcional)"), "logo.png");
    await userEvent.type(canvas.getByLabelText("Latitude (opcional)"), "95");
    await userEvent.clear(canvas.getByLabelText("Limite de denúncias"));
    await userEvent.click(canvas.getByRole("button", { name: "Criar organização" }));

    await expect(CreateSpy(args)).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Identificador (slug)")).toHaveAccessibleDescription(/Já existe uma organização com esse identificador/);
    await expect(canvas.getByLabelText("Endereço do logo (opcional)")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Latitude deve ser um número entre -90 e 90.")).toBeInTheDocument();
    await expect(canvas.getByText("Informe a longitude junto com a latitude.")).toBeInTheDocument();
    await expect(canvas.getByText("Informe um número inteiro de denúncias, a partir de 1.")).toBeInTheDocument();
  },
};

/** Admin editing their organization: no slug field; only changed fields are sent. */
export const EditAsAdmin: Story = {
  args: { ...EditArgs(), onCancel: undefined },
  play: async ({ canvas, args }) => {
    await expect(canvas.queryByLabelText("Identificador (slug)")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Salvar alterações" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Nada foi alterado.");

    await userEvent.clear(canvas.getByLabelText("Limite de denúncias"));
    await userEvent.type(canvas.getByLabelText("Limite de denúncias"), "2");
    await userEvent.click(canvas.getByRole("button", { name: "Salvar alterações" }));
    await expect(UpdateSpy(args)).toHaveBeenCalledWith({ shadowBanThreshold: 2 });
  },
};

/** Emptying a field that had a value is explained (the API can't remove values). */
export const CannotClearField: Story = {
  args: EditArgs(),
  play: async ({ canvas, args }) => {
    await userEvent.clear(canvas.getByLabelText("Descrição (opcional)"));
    await userEvent.click(canvas.getByRole("button", { name: "Salvar alterações" }));
    await expect(UpdateSpy(args)).not.toHaveBeenCalled();
    await expect(canvas.getByText(/não permite apagar este campo/)).toBeInTheDocument();
  },
};

/** The API refused the save; the form stays as typed. */
export const SaveFailed: Story = {
  args: { mode: "create", onCreate: fn(), error: "Não foi possível salvar. Já existe uma organização com esse identificador." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Já existe uma organização com esse identificador.");
  },
};

/** While saving the buttons are disabled. */
export const Saving: Story = {
  args: { mode: "create", onCreate: fn(), saving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  },
};
