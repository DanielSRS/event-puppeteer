/**
 * Public feed (home page) against the real API: every seeded event once on
 * desktop and phone, search and filter pills, likes that persist and reach a
 * second browser without reload, and the creator deleting their own event.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { Api, CloseBrowser, CreateEvent, DaysFromToday, HasHorizontalScroll, LoginAs, OpenPage, State, WEB } from "../support.ts";

after(CloseBrowser);

const SEEDED = ["Feira de Ciências", "Palestra de IA", "Semana de Calouros"];

/** Titles of the cards on screen, in order. */
async function CardTitles(page: Page): Promise<string[]> {
  return page.locator("article h2").allTextContents();
}

/** The card of the event titled `title`. */
function Card(page: Page, title: string) {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/** Waits until the feed finished loading. */
async function WaitForFeed(page: Page): Promise<void> {
  await page.getByRole("group", { name: "Filtrar eventos" }).waitFor();
}

describe("Público: mural", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`visitante vê cada evento uma única vez (${viewport})`, async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await page.goto(`${WEB}/`);
      await WaitForFeed(page);

      const titles = await CardTitles(page);
      for (const title of SEEDED) assert.equal(titles.filter((t) => t === title).length, 1, `${title} once`);
      assert.equal(new Set(titles).size, titles.length, "no duplicated card");
      assert.ok(!titles.includes("Evento da Outra Org"), "other organization's events stay out");

      const fair = Card(page, "Feira de Ciências");
      assert.equal(await fair.getByRole("link", { name: "Feira de Ciências", exact: true }).getAttribute("href"), await fair.getByRole("link", { name: /Ver detalhes/ }).getAttribute("href"));
      assert.ok(await fair.getByText("2 dias").isVisible());
      assert.ok(await fair.getByText("14:00 – 16:00").isVisible());
      assert.ok(await fair.getByRole("listitem").filter({ hasText: "Tecnologia" }).isVisible());
      assert.equal(await page.getByText(/inscrit/i).count(), 0, "no fake subscriptions");

      if (viewport === "desktop") {
        assert.equal(await page.locator('[role="img"][aria-label^="QR Code para"] svg').count(), 1, "real QR code");
      } else {
        assert.equal(await HasHorizontalScroll(page), false);
      }
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  test("busca e filtros mudam a lista", async () => {
    const { page, context, errors } = await OpenPage("mobile");
    await page.goto(`${WEB}/`);
    await WaitForFeed(page);
    const pills = page.getByRole("group", { name: "Filtrar eventos" });

    await page.getByLabel("Buscar eventos").fill("calouros");
    assert.deepEqual(await CardTitles(page), ["Semana de Calouros"]);

    await page.getByLabel("Buscar eventos").fill("ciencias");
    assert.deepEqual(await CardTitles(page), ["Feira de Ciências"]);

    await page.getByLabel("Buscar eventos").fill("nada-parecido-com-isto");
    await page.getByText("Nenhum evento encontrado para os critérios selecionados.").waitFor();

    await page.getByLabel("Buscar eventos").fill("");
    await pills.getByRole("button", { name: "Tecnologia" }).click();
    assert.equal(await pills.getByRole("button", { name: "Tecnologia" }).getAttribute("aria-pressed"), "true");
    const tagged = await CardTitles(page);
    assert.ok(tagged.includes("Feira de Ciências"));
    assert.ok(!tagged.includes("Palestra de IA"));
    assert.equal(await pills.getByRole("button", { name: "robotica" }).count(), 0, "free-form tags are not public");

    await pills.getByRole("button", { name: "Mais próximos" }).click();
    const soonest = await CardTitles(page);
    assert.ok(soonest.indexOf("Semana de Calouros") < soonest.indexOf("Feira de Ciências"));
    assert.ok(soonest.indexOf("Feira de Ciências") < soonest.indexOf("Palestra de IA"));

    await pills.getByRole("button", { name: "Mais curtidos" }).click();
    const counts = await page.locator("article button[aria-pressed]").evaluateAll((buttons) =>
      buttons.map((button) => Number(button.textContent?.match(/(\d+)\s*curtida/)?.[1])));
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));

    assert.equal(await HasHorizontalScroll(page), false);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("visitante que curte é convidado a entrar", async () => {
    const { page, context, errors } = await OpenPage("desktop");
    await page.goto(`${WEB}/`);
    await WaitForFeed(page);
    const card = Card(page, "Palestra de IA");
    await card.getByRole("button", { name: /Curtir/ }).click();
    const login = card.getByRole("link", { name: "Entrar" });
    assert.equal(await login.getAttribute("href"), "/entrar?redirect=%2F");
    assert.deepEqual(errors, []);
    await context.close();
  });

  test("membro curte, a curtida persiste e outro navegador vê sem recarregar", async () => {
    const { orgA } = await State();
    const title = `Curtida ao vivo ${Date.now()}`;
    await CreateEvent("admin", orgA.id, title);

    const watcher = await OpenPage("desktop");
    await watcher.page.goto(`${WEB}/`);
    await WaitForFeed(watcher.page);
    await Card(watcher.page, title).getByRole("button", { name: `Curtir “${title}”, 0 curtidas` }).waitFor();

    const member = await OpenPage("mobile");
    await LoginAs(member.page, "member");
    await WaitForFeed(member.page);
    const like = Card(member.page, title).getByRole("button", { name: /Curtir/ });
    assert.equal(await like.getAttribute("aria-pressed"), "false");
    await like.click();
    assert.equal(await like.getAttribute("aria-pressed"), "true");
    await Card(member.page, title).getByRole("button", { name: `Curtir “${title}”, 1 curtida`, pressed: true }).waitFor({ timeout: 1_000 });

    const started = Date.now();
    await Card(watcher.page, title).getByRole("button", { name: `Curtir “${title}”, 1 curtida` }).waitFor({ timeout: 6_500 });
    assert.ok(Date.now() - started <= 6_500, "second browser updated within ~6 s");

    await member.page.reload();
    await WaitForFeed(member.page);
    const after = Card(member.page, title).getByRole("button", { name: /Curtir/ });
    assert.equal(await after.getAttribute("aria-pressed"), "true", "heart survives reload");
    assert.equal(await Card(member.page, title).getByRole("button", { name: `Curtir “${title}”, 1 curtida` }).count(), 1);

    await after.click();
    await Card(member.page, title).getByRole("button", { name: `Curtir “${title}”, 0 curtidas`, pressed: false }).waitFor();

    assert.deepEqual(watcher.errors, []);
    assert.deepEqual(member.errors, []);
    await watcher.context.close();
    await member.context.close();
  });

  test("autor exclui o próprio evento pelo mural", async () => {
    const { orgA } = await State();
    const title = `Para excluir ${Date.now()}`;
    const id = await CreateEvent("member", orgA.id, title, { schedule: [{ date: DaysFromToday(5) }] });

    const { page, context, errors } = await OpenPage("mobile");
    await LoginAs(page, "member");
    await WaitForFeed(page);
    assert.equal(await Card(page, "Semana de Calouros").getByRole("button", { name: /Excluir/ }).count(), 0, "not on others' events");

    await Card(page, title).getByRole("button", { name: `Excluir “${title}”` }).click();
    const dialog = page.getByRole("alertdialog", { name: "Excluir este evento?" });
    await dialog.getByRole("button", { name: "Sim, excluir" }).click();
    await page.getByRole("status").filter({ hasText: `“${title}” foi excluído.` }).waitFor();
    assert.equal(await Card(page, title).count(), 0);

    const answer = await fetch(`${WEB}/api/organizations/${orgA.id}/events/${id}`);
    assert.equal(answer.status, 404);
    await Api(null, "GET", `/organizations/${orgA.id}/feed`).then((feed) => {
      assert.ok(Array.isArray(feed) && !feed.some((event: { id: string }) => event.id === id));
    });

    assert.deepEqual(errors, []);
    await context.close();
  });
});
