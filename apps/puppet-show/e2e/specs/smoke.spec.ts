/**
 * Harness sanity check: the stack is up, the seeded data is reachable and the
 * login helper works on every viewport.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, LoginAs, OpenPage, State, WEB } from "../support.ts";

after(CloseBrowser);

describe("Pilha de testes", () => {
  test("a API real responde com a organização semeada", async () => {
    const state = await State();
    assert.equal(state.orgA.name, "Universidade Estadual");
  });

  for (const viewport of ["desktop", "mobile"] as const) {
    test(`login pelo formulário funciona (${viewport})`, async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "member");
      assert.equal(new URL(page.url()).pathname, "/");
      await page.goto(`${WEB}/`);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
});
