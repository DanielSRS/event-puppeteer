/**
 * Images against the real API: a creator crops and uploads a banner on their
 * event's page; with no Screening Policy it waits in Image Review, so visitors
 * see only its Placeholder until a Moderator reveals and approves it. An Admin
 * uploads and removes the logo; the Superadmin sets the Screening Policy.
 *
 * The tests run in this order: the seed has no Screening Policy, and the last
 * test sets one (no other spec uploads Images). The logo ends removed, as
 * seeded.
 *
 * @module
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { CloseBrowser, CreateEvent, LoginAs, OpenPage, PictureFile, State, WEB } from "../support.ts";
import { CardOf, Finish, OpenAdminPage, WarmUp } from "./dashboard-admin-support.ts";

after(CloseBrowser);

/** Whether `picture` is a loaded `<img>` (not only the Placeholder). */
async function IsLoadedPicture(picture: Locator): Promise<boolean> {
  return picture.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0);
}

describe("Imagens: banner, revisão, logo e política de triagem", () => {
  const title = `Oficina de Fotografia ${Date.now().toString(36)}`;
  let eventId: string;

  before(async () => {
    const { orgA } = await State();
    eventId = await CreateEvent("member", orgA.id, title);
    await WarmUp([`/eventos/${eventId}`, "/dashboard/images", "/dashboard/settings", "/dashboard/global/screening"]);
  });

  test("criador recorta e envia o banner; visitantes veem só a prévia até o moderador revelar e aprovar", async () => {
    const creator = await OpenPage("desktop");
    await LoginAs(creator.page, "member", `/eventos/${eventId}`);
    await creator.page.getByRole("heading", { level: 1, name: title }).waitFor();
    await creator.page.getByText("Adicionar banner").click();
    await creator.page.getByLabel("Escolher imagem para o banner do evento").setInputFiles(PictureFile(1600, 1200));
    await creator.page.getByRole("button", { name: /Usar este recorte/ }).click();
    await creator.page.getByRole("status").filter({ hasText: "Banner atualizado." }).waitFor();
    const own = creator.page.getByRole("img", { name: `Banner do evento ${title}` });
    await own.waitFor();
    await creator.page.waitForFunction(() => [...document.images].some((img) => img.alt.startsWith("Banner do evento") && img.naturalWidth > 0));
    assert.equal(await IsLoadedPicture(own), true, "the creator sees their banner as published");
    await Finish(creator, false);

    const visitor = await OpenPage("desktop");
    await visitor.page.goto(`${WEB}/eventos/${eventId}`);
    const placeholder = visitor.page.getByRole("img", { name: `Banner do evento ${title}` });
    await placeholder.waitFor();
    assert.equal(await IsLoadedPicture(placeholder), false, "a visitor sees only the Placeholder");
    await Finish(visitor, false);

    const moderator = await OpenPage("desktop");
    await LoginAs(moderator.page, "moderator", "/dashboard/images");
    const main = await OpenAdminPage(moderator.page, "/dashboard/images", "Imagens em Revisão");
    const subject = `Banner do evento “${title}”`;
    const card = CardOf(main, subject);
    await card.getByText(/Não analisada automaticamente/).waitFor();
    await card.getByRole("button", { name: `Revelar imagem ${subject}` }).click();
    await moderator.page.waitForFunction((alt) => [...document.images].some((img) => img.alt === alt && img.naturalWidth > 0), subject);
    await card.getByRole("button", { name: `Aprovar ${subject}` }).click();
    await main.getByRole("status").filter({ hasText: `${subject} aprovada` }).waitFor();
    await Finish(moderator, false);

    const later = await OpenPage("desktop");
    await later.page.goto(`${WEB}/eventos/${eventId}`);
    await later.page.waitForFunction((alt) => [...document.images].some((img) => img.alt === alt && img.naturalWidth > 0), `Banner do evento ${title}`);
    await Finish(later, false);
  });

  test("admin envia o logo nas configurações e depois o remove", async () => {
    const admin = await OpenPage("desktop");
    await LoginAs(admin.page, "admin", "/dashboard/settings");
    const main = await OpenAdminPage(admin.page, "/dashboard/settings", "Configurações");
    await main.getByText("A organização ainda não tem logo.").waitFor();
    await main.getByLabel("Escolher imagem para o logo da organização").setInputFiles(PictureFile(900, 700));
    await main.getByRole("button", { name: /Usar este recorte/ }).click();
    await main.getByRole("status").filter({ hasText: "Logo atualizado." }).waitFor();
    await main.getByRole("img", { name: "Logo de Universidade Estadual" }).waitFor();

    await main.getByRole("button", { name: "Remover logo" }).click();
    await main.getByRole("status").filter({ hasText: "Logo removido." }).waitFor();
    await main.getByText("A organização ainda não tem logo.").waitFor();
    await Finish(admin, false);
  });

  test("superadmin define a política de triagem pela primeira vez", async () => {
    const superadmin = await OpenPage("desktop");
    await LoginAs(superadmin.page, "superadmin", "/dashboard/global/screening");
    const main = await OpenAdminPage(superadmin.page, "/dashboard/global/screening", "Política de Triagem");
    await main.getByText(/Nenhuma política definida ainda/).waitFor();

    await main.getByRole("button", { name: "Salvar política" }).click();
    await main.getByText("Informe os dois limites como números inteiros de 0 a 100.").first().waitFor();

    for (const field of await main.getByLabel("Revisar a partir de (%)").all()) await field.fill("30");
    for (const field of await main.getByLabel("Recusar a partir de (%)").all()) await field.fill("80");
    await main.getByRole("button", { name: "Salvar política" }).click();
    await main.getByRole("status").filter({ hasText: "Política de triagem salva." }).waitFor();

    await superadmin.page.reload();
    const reloaded = await OpenAdminPage(superadmin.page, "/dashboard/global/screening", "Política de Triagem");
    assert.equal(await reloaded.getByText(/Nenhuma política definida ainda/).count(), 0);
    assert.equal(await reloaded.getByLabel("Recusar a partir de (%)").first().inputValue(), "80");
    await Finish(superadmin, false);
  });
});
