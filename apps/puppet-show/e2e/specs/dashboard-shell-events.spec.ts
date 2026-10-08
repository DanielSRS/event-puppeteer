/**
 * "Meus Eventos" and the event editor against the real API: creating a full
 * event through the dashboard wizard and through `/eventos/novo`, seeing it in
 * the list and on its public page, deleting, the hidden badge, and the
 * session rules of `/eventos/novo`. Desktop and phone.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { Api, CloseBrowser, CreateEvent, DaysFromToday, LoginAs, OpenPage, State, WEB, type ViewportName } from "../support.ts";
import { AssertNoSideScroll, ManagedContext, SwitchContext } from "./dashboard-shell-support.ts";

after(CloseBrowser);

/** Shape of the events the API returns, as far as these specs look at them. */
type ApiEvent = {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  schedule: Array<{ date: string; startTime?: string; endTime?: string }>;
  tags: Array<{ tagId: string; isFreeForm: boolean }>;
  links: Array<{ labelId: string; url: string }>;
};

/** A title no other test uses. */
function UniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

/** The card of `title` in "Meus Eventos". */
function Card(page: Page, title: string) {
  return page.getByRole("list", { name: "Seus eventos" }).getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/** The person's own events in orgA, straight from the API. */
async function Mine(role: "member" | "superadmin"): Promise<ApiEvent[]> {
  const { orgA } = await State();
  const events = await Api(role, "GET", `/organizations/${orgA.id}/events/mine`);
  assert.ok(Array.isArray(events));
  return events as ApiEvent[];
}

/** Fills step 1 of the editor and moves on. */
async function FillBasics(page: Page, title: string, coordinates: boolean): Promise<void> {
  await page.getByLabel("Nome do evento").fill(title);
  await page.getByLabel("Descrição").fill("Mostra de projetos com robôs, drones e oficinas abertas.");
  await page.getByLabel("Local", { exact: true }).fill("Pavilhão de Aulas 3");
  if (coordinates) {
    await page.getByLabel("Latitude").fill("-12.2");
    await page.getByLabel("Longitude").fill("-38.97");
    await page.getByTitle("Mapa com a localização do evento").waitFor();
  }
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("heading", { name: /Etapa 2 de 3/ }).waitFor();
}

for (const viewport of ["desktop", "mobile"] as const satisfies readonly ViewportName[]) {
  describe(`Painel: Meus Eventos e editor (${viewport})`, () => {
    test("cria pelo assistente um evento de 2 dias com tag oficial, tag livre nova, tag livre existente, link e coordenadas", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      const title = UniqueTitle("Mostra de Robótica");
      const freeTag = `drones-${viewport}-${Date.now().toString(36)}`;
      await LoginAs(page, "member");
      await page.goto(`${WEB}/dashboard/events`);
      await page.getByRole("button", { name: "Novo evento" }).click();
      const drawer = page.getByRole("dialog", { name: "Novo evento" });
      await drawer.getByRole("heading", { name: /Etapa 1 de 3/ }).waitFor();

      await FillBasics(page, title, true);
      await drawer.getByLabel("Data", { exact: true }).fill(DaysFromToday(5));
      await drawer.getByLabel("Início (opcional)").fill("14:00");
      await drawer.getByLabel("Término (opcional)").fill("17:00");
      await drawer.getByRole("button", { name: "Adicionar dia" }).click();
      await drawer.getByLabel("Data", { exact: true }).nth(1).fill(DaysFromToday(6));
      await drawer.getByLabel("Início (opcional)").nth(1).fill("09:00");
      await drawer.getByRole("button", { name: "Avançar" }).click();
      await drawer.getByRole("heading", { name: /Etapa 3 de 3/ }).waitFor();

      await drawer.getByRole("button", { name: "Tecnologia" }).click();
      await drawer.getByLabel("Nova tag livre").fill(freeTag);
      await drawer.getByRole("button", { name: "Adicionar tag" }).click();
      await drawer.getByRole("button", { name: `Remover a tag ${freeTag}` }).waitFor();
      await drawer.getByLabel("Nova tag livre").fill("Robotica");
      await drawer.getByRole("button", { name: "Adicionar tag" }).click();
      await drawer.getByRole("button", { name: "Remover a tag robotica" }).waitFor();

      await drawer.getByRole("button", { name: "Adicionar link" }).click();
      await drawer.getByLabel("Tipo do link 1").selectOption({ label: "Inscrição" });
      await drawer.getByLabel("Endereço do link 1").fill("https://example.org/mostra");
      await AssertNoSideScroll(page, viewport);
      await drawer.getByRole("button", { name: "Publicar evento" }).click();

      await page.getByRole("status").filter({ hasText: `Evento "${title}" publicado.` }).waitFor();
      await Card(page, title).getByText("Ativo").waitFor();

      const created = (await Mine("member")).find((event) => event.title === title);
      assert.ok(created, "the event reached the API");
      assert.deepEqual(created.schedule.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })), [
        { date: DaysFromToday(5), startTime: "14:00", endTime: "17:00" },
        { date: DaysFromToday(6), startTime: "09:00", endTime: undefined },
      ]);
      assert.equal(created.latitude, -12.2);
      assert.equal(created.longitude, -38.97);
      assert.equal(created.tags.length, 3);
      assert.equal(created.tags.filter((tag) => tag.isFreeForm).length, 2);
      assert.deepEqual(created.links.map((link) => link.url), ["https://example.org/mostra"]);

      await Card(page, title).getByRole("link", { name: `Ver página de ${title}` }).click();
      await page.waitForURL((url) => url.pathname === `/eventos/${created.id}`);
      await page.getByRole("heading", { name: title }).waitFor();
      await AssertNoSideScroll(page, viewport);

      assert.deepEqual(errors, [
        "console: Failed to load resource: the server responded with a status of 409 (Conflict)",
      ], "the only console error is the browser logging the expected 409 for the existing tag \"robotica\"");
      await context.close();
    });

    test("cria por /eventos/novo e abre a página pública do evento", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      const title = UniqueTitle("Sarau de Poesia");
      await LoginAs(page, "member");
      await page.goto(`${WEB}/eventos/novo`);
      await page.getByRole("heading", { name: /Etapa 1 de 3/ }).waitFor();
      await FillBasics(page, title, false);
      await page.getByLabel("Data", { exact: true }).fill(DaysFromToday(3));
      await page.getByRole("button", { name: "Avançar" }).click();
      await page.getByRole("button", { name: "Cultura" }).click();
      await AssertNoSideScroll(page, viewport);
      await page.getByRole("button", { name: "Publicar evento" }).click();

      await page.waitForURL((url) => url.pathname.startsWith("/eventos/") && url.pathname !== "/eventos/novo");
      await page.getByRole("heading", { name: title }).waitFor();
      assert.ok((await Mine("member")).some((event) => event.title === title));

      assert.deepEqual(errors, []);
      await context.close();
    });

    test("o editor recusa dados inválidos e mostra o resumo ao publicar", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "member");
      await page.goto(`${WEB}/eventos/novo`);
      await page.getByRole("button", { name: "Avançar" }).click();
      assert.equal(await page.getByLabel("Nome do evento").getAttribute("aria-invalid"), "true");

      await FillBasics(page, UniqueTitle("Evento inválido"), false);
      await page.getByLabel("Data", { exact: true }).fill(DaysFromToday(3));
      await page.getByLabel("Término (opcional)").fill("10:00");
      await page.getByRole("button", { name: "Avançar" }).click();
      await page.getByText("Para informar o término, informe também o início.").waitFor();
      await page.getByLabel("Início (opcional)").fill("11:00");
      await page.getByText("O término não pode ser antes do início.").waitFor();
      await page.getByLabel("Término (opcional)").fill("12:00");
      await page.getByRole("button", { name: "Avançar" }).click();

      await page.getByRole("button", { name: "Adicionar link" }).click();
      await page.getByLabel("Endereço do link 1").fill("example.org");
      await page.getByRole("button", { name: "Publicar evento" }).click();
      await page.getByRole("alert").filter({ hasText: "Corrija os 2 campos" }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/eventos/novo");

      await AssertNoSideScroll(page, viewport);
      assert.deepEqual(errors, []);
      await context.close();
    });

    test("exclui um evento próprio com confirmação", async () => {
      const { orgA } = await State();
      const title = UniqueTitle("Evento para excluir");
      await CreateEvent("member", orgA.id, title);

      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "member");
      await page.goto(`${WEB}/dashboard/events`);
      await Card(page, title).getByRole("button", { name: `Excluir ${title}` }).click();
      const dialog = page.getByRole("alertdialog", { name: "Excluir este evento?" });
      await dialog.getByRole("button", { name: "Sim, excluir" }).click();

      await page.getByRole("status").filter({ hasText: `Evento "${title}" excluído.` }).waitFor();
      assert.equal(await Card(page, title).count(), 0);
      assert.equal((await Mine("member")).some((event) => event.title === title), false);

      assert.deepEqual(errors, []);
      await context.close();
    });

    test("evento próprio oculto pela moderação aparece como Oculto", async () => {
      const { orgA } = await State();
      const title = UniqueTitle("Evento ocultado");
      const id = await CreateEvent("member", orgA.id, title);
      await Api("moderator", "POST", `/organizations/${orgA.id}/events/${id}/hide`);

      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "member");
      await page.goto(`${WEB}/dashboard/events`);
      await Card(page, title).getByText("Oculto pela moderação").waitFor();
      await AssertNoSideScroll(page, viewport);

      assert.deepEqual(errors, []);
      await context.close();
    });

    test("superadmin na organização vê os eventos que criou nela", async () => {
      const { orgA } = await State();
      const title = UniqueTitle("Evento do superadmin");
      await CreateEvent("superadmin", orgA.id, title);

      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "superadmin");
      await page.goto(`${WEB}/dashboard`);
      await page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");
      await SwitchContext(page, viewport, "Universidade Estadual");
      await page.waitForURL((url) => url.pathname === "/dashboard/events");
      assert.equal(await ManagedContext(page), "Universidade Estadual");
      await Card(page, title).getByText("Ativo").waitFor();

      assert.deepEqual(errors, []);
      await context.close();
    });

    test("/eventos/novo: sem sessão vai ao login; superadmin é orientado a usar o painel", async () => {
      const anonymous = await OpenPage(viewport);
      await anonymous.page.goto(`${WEB}/eventos/novo`);
      await anonymous.page.waitForURL((url) => url.pathname === "/entrar");
      assert.equal(new URL(anonymous.page.url()).searchParams.get("redirect"), "/eventos/novo");
      assert.deepEqual(anonymous.errors, []);
      await anonymous.context.close();

      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "superadmin");
      await page.goto(`${WEB}/eventos/novo`);
      await page.getByText(/Superadmins não pertencem a uma organização/).waitFor();
      await page.getByRole("link", { name: "Ir para Meus Eventos no painel" }).click();
      await page.waitForURL((url) => url.pathname === "/dashboard/events");
      assert.deepEqual(errors, []);
      await context.close();
    });
  });
}
