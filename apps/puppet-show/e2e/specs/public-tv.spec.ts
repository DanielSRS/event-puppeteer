/**
 * TV display (kiosk mode) against the real API: branding, clock, real QR code,
 * events without repetition, no site navigation.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, HasHorizontalScroll, OpenPage, State, WEB } from "../support.ts";

after(CloseBrowser);

describe("Público: modo TV", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`mostra organização, relógio, QR Code e eventos sem repetir (${viewport})`, async () => {
      const { orgA } = await State();
      const { page, context, errors } = await OpenPage(viewport);
      await page.goto(`${WEB}/display`);

      await page.getByRole("heading", { level: 1, name: `Eventos · ${orgA.name}` }).waitFor();
      const list = page.getByRole("list", { name: "Eventos em exibição" });
      await list.waitFor();

      const titles = await list.locator("h2").allTextContents();
      assert.ok(titles.length >= 1 && titles.length <= 3, "a window holds up to three events");
      assert.equal(new Set(titles).size, titles.length, "no repeated event");
      assert.ok(!titles.includes("Evento da Outra Org"));

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
