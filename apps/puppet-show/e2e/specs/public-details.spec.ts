/**
 * Event details page against the real API: schedule, tags, links and map;
 * the report flow (and the duplicate-report answer); a moderator hiding and
 * showing an event again; hidden events unavailable to the public.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Api, CloseBrowser, CreateEvent, DaysFromToday, HasHorizontalScroll, LoginAs, OpenPage, State, WEB } from "../support.ts";

after(CloseBrowser);

/** Console lines browsers print for an expected non-2xx answer (e.g. a refused second report). */
function Unexpected(errors: string[], statuses: number[]): string[] {
  return errors.filter((error) => !statuses.some((status) => error.includes(`status of ${status}`)));
}

/** Id of a public catalog entry by name. */
async function IdOf(path: "/tags" | "/link-labels", name: string): Promise<string> {
  const list = (await Api(null, "GET", path)) as Array<{ id: string; name: string }>;
  const found = list.find((item) => item.name === name);
  if (found === undefined) throw new Error(`${name} not in ${path}`);
  return found.id;
}

describe("Público: detalhes do evento", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`mostra programação, categorias, links e mapa (${viewport})`, async () => {
      const { orgA } = await State();
      const title = `Detalhes completos ${viewport} ${Date.now()}`;
      const id = await CreateEvent("member", orgA.id, title, {
        latitude: -12.2,
        longitude: -38.97,
        schedule: [{ date: DaysFromToday(3), startTime: "08:00", endTime: "12:00" }, { date: DaysFromToday(4) }],
        tags: [{ tagId: await IdOf("/tags", "Tecnologia"), isFreeForm: false }],
        links: [{ labelId: await IdOf("/link-labels", "Inscrição"), url: "https://example.org/inscricao" }],
      });

      const { page, context, errors } = await OpenPage(viewport);
      await page.goto(`${WEB}/eventos/${id}`);
      await page.getByRole("heading", { level: 1, name: title }).waitFor();

      assert.ok(await page.getByText("08:00 – 12:00").isVisible());
      assert.ok(await page.getByText("Dia todo").isVisible());
      assert.ok(await page.getByRole("list", { name: "Categorias" }).getByText("Tecnologia").isVisible());
      assert.equal(await page.getByRole("link", { name: /Inscrição/ }).getAttribute("href"), "https://example.org/inscricao");
      const map = page.locator("iframe");
      assert.equal(await map.getAttribute("title"), "Mapa: Auditório Central");
      assert.match((await map.getAttribute("src")) ?? "", /openstreetmap\.org\/export\/embed\.html.*marker=-12\.2,-38\.97/);
      assert.match((await page.getByRole("link", { name: /Abrir no mapa/ }).getAttribute("href")) ?? "", /mlat=-12\.2&mlon=-38\.97/);
      await page.getByRole("button", { name: `Curtir “${title}”, 0 curtidas` }).waitFor();

      if (viewport === "mobile") assert.equal(await HasHorizontalScroll(page), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  test("denúncia explica a regra, fica registrada e a segunda é recusada", async () => {
    const { orgA } = await State();
    const title = `Para denunciar ${Date.now()}`;
    const id = await CreateEvent("member", orgA.id, title);

    const { page, context, errors } = await OpenPage("mobile");
    await LoginAs(page, "reporter", `/eventos/${id}`);

    const stale = await OpenPage("desktop");
    await LoginAs(stale.page, "reporter", `/eventos/${id}`);
    await stale.page.getByRole("button", { name: "Denunciar", exact: true }).waitFor();

    await page.getByRole("button", { name: "Denunciar", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Denunciar evento" });
    await drawer.getByText(/denúncias? de pessoas diferentes, o evento é ocultado automaticamente/).waitFor();
    await drawer.getByLabel("Spam").check();
    await drawer.getByLabel("Comentário (opcional)").fill("Teste e2e");
    await drawer.getByRole("button", { name: "Enviar denúncia" }).click();
    await page.getByRole("status").filter({ hasText: "Denúncia enviada" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Denunciado" }).isDisabled(), true);

    await page.reload();
    const reported = page.getByRole("button", { name: "Denunciado" });
    await reported.waitFor();
    assert.equal(await reported.isDisabled(), true);

    await stale.page.getByRole("button", { name: "Denunciar", exact: true }).click();
    const staleDrawer = stale.page.getByRole("dialog", { name: "Denunciar evento" });
    await staleDrawer.getByLabel("Evento duplicado").check();
    await staleDrawer.getByRole("button", { name: "Enviar denúncia" }).click();
    await stale.page.getByRole("alert").filter({ hasText: "Você já denunciou este evento." }).waitFor();
    assert.equal(await stale.page.getByRole("button", { name: "Denunciado" }).isDisabled(), true);

    const reports = (await Api("moderator", "GET", `/organizations/${orgA.id}/reports`)) as Array<{ eventId: string }>;
    assert.equal(reports.filter((report) => report.eventId === id).length, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(Unexpected(stale.errors, [400]), []);
    await context.close();
    await stale.context.close();
  });

  test("visitante precisa entrar para denunciar", async () => {
    const { page, context, errors } = await OpenPage("desktop");
    const { orgA } = await State();
    const id = await CreateEvent("member", orgA.id, `Visitante denuncia ${Date.now()}`);
    await page.goto(`${WEB}/eventos/${id}`);
    await page.getByRole("button", { name: "Denunciar", exact: true }).click();
    assert.equal(await page.getByRole("link", { name: "Entrar" }).last().getAttribute("href"), `/entrar?redirect=${encodeURIComponent(`/eventos/${id}`)}`);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("moderador oculta o evento; o público deixa de vê-lo; reexibir devolve", async () => {
    const { orgA } = await State();
    const title = `Para ocultar ${Date.now()}`;
    const id = await CreateEvent("member", orgA.id, title);

    const mod = await OpenPage("desktop");
    await LoginAs(mod.page, "moderator", `/eventos/${id}`);
    await mod.page.getByRole("button", { name: "Ocultar evento" }).click();
    await mod.page.getByRole("alertdialog", { name: "Ocultar este evento?" }).getByRole("button", { name: "Sim, ocultar" }).click();
    await mod.page.getByRole("status").filter({ hasText: "Evento ocultado do mural." }).waitFor();
    await mod.page.getByText(/Oculto pela moderação/).waitFor();

    const visitor = await OpenPage("mobile");
    await visitor.page.goto(`${WEB}/eventos/${id}`);
    await visitor.page.getByRole("alert").filter({ hasText: "Evento não encontrado ou indisponível." }).waitFor();
    const feed = (await Api(null, "GET", `/organizations/${orgA.id}/feed`)) as Array<{ id: string }>;
    assert.ok(!feed.some((event) => event.id === id));

    await mod.page.reload();
    await mod.page.getByRole("button", { name: "Reexibir evento" }).click();
    await mod.page.getByRole("alertdialog", { name: "Reexibir este evento?" }).getByRole("button", { name: "Sim, reexibir" }).click();
    await mod.page.getByRole("status").filter({ hasText: "Evento visível no mural novamente." }).waitFor();

    await visitor.page.reload();
    await visitor.page.getByRole("heading", { level: 1, name: title }).waitFor();

    assert.deepEqual(mod.errors, []);
    assert.deepEqual(Unexpected(visitor.errors, [404]), []);
    await mod.context.close();
    await visitor.context.close();
  });

  test("membro comum não vê ações de moderação; autor exclui pelo detalhe", async () => {
    const { orgA } = await State();
    const title = `Autor exclui ${Date.now()}`;
    const id = await CreateEvent("member", orgA.id, title);

    const { page, context, errors } = await OpenPage("mobile");
    await LoginAs(page, "member", `/eventos/${id}`);
    await page.getByRole("heading", { level: 1, name: title }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Ocultar evento" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Denunciar", exact: true }).count(), 0, "no reporting your own event");
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("alertdialog", { name: "Excluir este evento?" }).getByRole("button", { name: "Sim, excluir" }).click();
    await page.waitForURL(`${WEB}/`);

    const answer = await fetch(`${WEB}/api/organizations/${orgA.id}/events/${id}`);
    assert.equal(answer.status, 404);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("evento inexistente diz que não foi encontrado", async () => {
    const { page, context, errors } = await OpenPage("desktop");
    await page.goto(`${WEB}/eventos/00000000-0000-0000-0000-000000000000`);
    await page.getByRole("alert").filter({ hasText: "Evento não encontrado ou indisponível." }).waitFor();
    assert.deepEqual(Unexpected(errors, [404]), []);
    await context.close();
  });
});
