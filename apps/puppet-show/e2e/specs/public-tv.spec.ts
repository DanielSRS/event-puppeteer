/**
 * TV display (kiosk mode) against the real API: branding, clock, real QR code,
 * the featured event, the agenda without repetition, no site navigation.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, HasHorizontalScroll, OpenPage, State, WEB } from "../support.ts";

after(CloseBrowser);

describe("Público: modo TV", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`mostra organização, relógio, QR Code, evento em destaque e agenda sem repetir (${viewport})`, async () => {
      const { orgA } = await State();
      const { page, context, errors } = await OpenPage(viewport);
      await page.goto(`${WEB}/display`);

      await page.getByRole("heading", { level: 1, name: `Eventos · ${orgA.name}` }).waitFor();
      const featured = page.getByRole("article", { name: "Evento em exibição" });
      await featured.waitFor();
      const title = (await featured.locator("h2").textContent()) ?? "";
      assert.ok(title.trim() !== "", "an event is featured");
      assert.notEqual(title, "Evento da Outra Org");

      const agenda = await page.getByRole("list", { name: "Agenda" }).locator("h3").allTextContents();
      assert.ok(agenda.length >= 1 && agenda.length <= 5, "the agenda holds up to five events");
      assert.equal(new Set(agenda).size, agenda.length, "no repeated event in the agenda");
      assert.ok(!agenda.includes("Evento da Outra Org"));

      assert.match((await page.locator("time").textContent()) ?? "", /^\d{2}:\d{2}$/);
      assert.equal(await page.locator('[role="img"][aria-label^="QR Code para"] svg').count(), 1);
      assert.equal(await page.getByRole("navigation", { name: "Principal" }).count(), 0, "kiosk has no navbar");
      assert.equal(await page.locator("main").getByRole("alert").count(), 0, "no error on screen");

      if (viewport === "mobile") assert.equal(await HasHorizontalScroll(page), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
});
