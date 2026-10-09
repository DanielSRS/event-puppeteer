import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";
import { Err, Ok, type Result } from "@/lib/result";
import type { LinkLabel, Tag } from "@/lib/api/schemas";
import { EventForm } from "./EventForm";
import type { Coordinates } from "./EventFormBasics";

/** Tags the API would list: two official ones and an unpromoted suggestion. */
const TAGS: Tag[] = [
  { id: "tag-tec", name: "Tecnologia", isSystemDefined: true },
  { id: "tag-cul", name: "Cultura", isSystemDefined: true },
  { id: "tag-rob", name: "robotica", isSystemDefined: false },
];

const LABELS: LinkLabel[] = [
  { id: "label-ins", name: "Inscrição" },
  { id: "label-site", name: "Site do evento" },
];

const meta = {
  title: "Components/Forms/EventForm",
  component: EventForm,
  parameters: { layout: "padded" },
  args: {
    tags: TAGS,
    linkLabels: LABELS,
    today: "2026-10-08",
    busy: false,
    generalError: "",
    onSubmit: fn(),
    onCreateTag: fn(async (name: string): Promise<Result<Tag, string>> => Ok({ id: `tag-${name}`, name, isSystemDefined: false })),
    onLocate: fn(async (): Promise<Result<Coordinates, string>> => Ok({ latitude: -12.2, longitude: -38.97 })),
  },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="mx-auto max-w-2xl"><Story /></div>],
} satisfies Meta<typeof EventForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Canvas queries used by the helpers below. */
type Canvas = Parameters<NonNullable<Story["play"]>>[0]["canvas"];

/** Fills step 1 with valid data and moves to step 2. */
async function FillBasics(canvas: Canvas) {
  await userEvent.type(canvas.getByLabelText("Nome do evento"), "Feira de Robótica");
  await userEvent.type(canvas.getByLabelText("Descrição"), "Exposição de robôs feitos pelos estudantes.");
  await userEvent.type(canvas.getByLabelText("Local"), "Pavilhão de Aulas");
  await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
  await expect(await canvas.findByRole("heading", { name: /Etapa 2 de 3/ })).toHaveFocus();
}

/** Sets the date of a schedule row (date inputs don't take typed text reliably). */
function SetDate(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** First step, nothing filled. */
export const Empty: Story = {};

/** Trying to advance with empty fields shows each error next to its field. */
export const BasicsErrors: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    const title = canvas.getByLabelText("Nome do evento");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription(/pelo menos 3 letras/);
    await expect(canvas.getByLabelText("Descrição")).toHaveAccessibleDescription(/pelo menos 10/);
    await expect(canvas.getByLabelText("Local")).toHaveAccessibleDescription(/onde o evento acontece/);
    await expect(title).toHaveFocus();
    await expect(canvas.getByRole("heading", { name: /Etapa 1 de 3/ })).toBeInTheDocument();
  },
};

/** Coordinates out of range, or only one of them, are rejected. */
export const CoordinateErrors: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText("Latitude"), "95");
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    await expect(canvas.getByLabelText("Latitude")).toHaveAccessibleDescription(/entre -90 e 90/);
    await expect(canvas.getByLabelText("Longitude")).toHaveAccessibleDescription(/Informe a longitude/);
  },
};

/** "Usar minha localização" fills the coordinates and shows the map preview. */
export const LocateSuccess: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Usar minha localização" }));
    await expect(args.onLocate).toHaveBeenCalled();
    await waitFor(() => expect(canvas.getByLabelText("Latitude")).toHaveValue(-12.2));
    await expect(canvas.getByLabelText("Longitude")).toHaveValue(-38.97);
    await expect(canvas.getByTitle("Mapa com a localização do evento")).toBeInTheDocument();
  },
};

/** A refused or failed position request is explained to the person. */
export const LocateDenied: Story = {
  args: {
    onLocate: fn(async (): Promise<Result<Coordinates, string>> => Err("Permissão de localização negada. Autorize o acesso à localização nas configurações do navegador.")),
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Usar minha localização" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(/Permissão de localização negada/);
    await expect(canvas.queryByTitle("Mapa com a localização do evento")).not.toBeInTheDocument();
  },
};

/** Schedule rules: end needs start, end not before start, no repeated date, no past date. */
export const ScheduleErrors: Story = {
  play: async ({ canvas }) => {
    await FillBasics(canvas);
    SetDate(canvas.getByLabelText("Data"), "2026-10-07");
    await userEvent.type(canvas.getByLabelText("Término (opcional)"), "1000");
    await userEvent.click(canvas.getByRole("button", { name: "Adicionar dia" }));
    const dates = canvas.getAllByLabelText("Data");
    await expect(dates).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));

    await expect(dates[0]).toHaveAccessibleDescription(/anterior a hoje/);
    await expect(canvas.getAllByLabelText("Término (opcional)")[0]).toHaveAccessibleDescription(/informe também o início/);
    await expect(dates[1]).toHaveAccessibleDescription(/Escolha a data/);

    SetDate(dates[0], "2026-10-10");
    SetDate(dates[1], "2026-10-10");
    await userEvent.type(canvas.getAllByLabelText("Início (opcional)")[0], "1100");
    await expect(dates[1]).toHaveAccessibleDescription(/já está na programação/);
    await expect(canvas.getAllByLabelText("Término (opcional)")[0]).toHaveAccessibleDescription(/antes do início/);

    await userEvent.click(canvas.getByRole("button", { name: "Remover dia 2" }));
    await expect(canvas.getAllByLabelText("Data")).toHaveLength(1);
  },
};

/** Full flow: two days, an official tag, a new free-form tag, a link and a banner. */
export const PublishFullEvent: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.type(canvas.getByLabelText("Latitude"), "-12.2");
    await userEvent.type(canvas.getByLabelText("Longitude"), "-38.97");
    await expect(canvas.getByTitle("Mapa com a localização do evento")).toBeInTheDocument();
    await FillBasics(canvas);

    SetDate(canvas.getByLabelText("Data"), "2026-10-12");
    await userEvent.type(canvas.getByLabelText("Início (opcional)"), "0900");
    await userEvent.type(canvas.getByLabelText("Término (opcional)"), "1200");
    await userEvent.click(canvas.getByRole("button", { name: "Adicionar dia" }));
    SetDate(canvas.getAllByLabelText("Data")[1], "2026-10-10");
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    await expect(await canvas.findByRole("heading", { name: /Etapa 3 de 3/ })).toBeInTheDocument();

    const tecnologia = canvas.getByRole("button", { name: "Tecnologia" });
    await userEvent.click(tecnologia);
    await expect(tecnologia).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.queryByRole("button", { name: "robotica" })).not.toBeInTheDocument();

    await userEvent.type(canvas.getByLabelText("Nova tag livre"), "drones");
    await userEvent.click(canvas.getByRole("button", { name: /Adicionar tag/ }));
    await expect(args.onCreateTag).toHaveBeenCalledWith("drones");
    await expect(await canvas.findByRole("button", { name: "Remover a tag drones" })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Adicionar link" }));
    await userEvent.selectOptions(canvas.getByLabelText("Tipo do link 1"), "Inscrição");
    await userEvent.type(canvas.getByLabelText("Endereço do link 1"), "https://example.org/inscricao");

    await userEvent.click(canvas.getByRole("button", { name: /Publicar evento/ }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      title: "Feira de Robótica",
      description: "Exposição de robôs feitos pelos estudantes.",
      location: "Pavilhão de Aulas",
      latitude: -12.2,
      longitude: -38.97,
      isHidden: false,
      schedule: [{ date: "2026-10-10" }, { date: "2026-10-12", startTime: "09:00", endTime: "12:00" }],
      tags: [{ tagId: "tag-tec", isFreeForm: false }, { tagId: "tag-drones", isFreeForm: true }],
      links: [{ labelId: "label-ins", url: "https://example.org/inscricao" }],
    });
  },
};

/** Publishing with invalid links lists every problem; an entry takes the person to the field. */
export const SubmitSummary: Story = {
  args: { onSubmit: fn() },
  play: async ({ args, canvas }) => {
    await FillBasics(canvas);
    SetDate(canvas.getByLabelText("Data"), "2026-10-10");
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    await userEvent.click(await canvas.findByRole("button", { name: "Adicionar link" }));
    await userEvent.type(canvas.getByLabelText("Endereço do link 1"), "example.org");
    await userEvent.type(canvas.getByLabelText(/imagem de banner/), "ftp://example.org/a.png");
    await userEvent.click(canvas.getByRole("button", { name: /Publicar evento/ }));

    const summary = await canvas.findByRole("alert");
    await expect(summary).toHaveFocus();
    await expect(summary).toHaveTextContent(/Corrija os 3 campos/);
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Endereço do link 1")).toHaveAccessibleDescription(/http/);

    await userEvent.click(canvas.getByRole("button", { name: /Link 1: tipo/ }));
    await expect(canvas.getByLabelText("Tipo do link 1")).toHaveFocus();
  },
};

/** Creating a free-form tag can fail; the reason is shown under the field. */
export const FreeFormTagError: Story = {
  args: {
    onCreateTag: fn<(name: string) => Promise<Result<Tag, string>>>(async () => Err("Não foi possível criar a tag. Não foi possível falar com o servidor.")),
  },
  play: async ({ canvas }) => {
    await FillBasics(canvas);
    SetDate(canvas.getByLabelText("Data"), "2026-10-10");
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    const field = await canvas.findByLabelText("Nova tag livre");
    await userEvent.click(canvas.getByRole("button", { name: /Adicionar tag/ }));
    await expect(field).toHaveAccessibleDescription(/Digite o nome da tag/);
    await userEvent.type(field, "drones{Enter}");
    await waitFor(() => expect(field).toHaveAccessibleDescription(/falar com o servidor/));
  },
};

/** No catalogs yet: the editor says so instead of showing empty controls. */
export const WithoutCatalogs: Story = {
  args: { tags: [], linkLabels: [] },
  play: async ({ canvas }) => {
    await FillBasics(canvas);
    SetDate(canvas.getByLabelText("Data"), "2026-10-10");
    await userEvent.click(canvas.getByRole("button", { name: /Avançar/ }));
    await expect(await canvas.findByText(/Nenhuma tag oficial/)).toBeInTheDocument();
    await expect(canvas.getByText(/Nenhum tipo de link cadastrado/)).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Adicionar link" })).not.toBeInTheDocument();
  },
};

/** The API refused the event: the reason is shown above the buttons. */
export const PublishFailed: Story = {
  args: { generalError: "Não foi possível publicar o evento. Você não tem permissão para fazer isso." },
};

/** While publishing, every control is locked. */
export const Publishing: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Nome do evento")).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /Avançar/ })).toBeDisabled();
  },
};

/** In the dashboard the first step offers "Cancelar". */
export const Cancellable: Story = {
  args: { onCancel: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Cancelar" }));
    await expect(args.onCancel).toHaveBeenCalled();
  },
};
