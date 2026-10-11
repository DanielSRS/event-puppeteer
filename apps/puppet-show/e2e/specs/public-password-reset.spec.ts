/**
 * "Esqueci minha senha" end to end: from the login page to the emailed link,
 * a new password, and logging in with it. The link works once; an unknown
 * address gets the same answer as a real one.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { API, CloseBrowser, OpenPage, Outbox, State, WEB } from "../support.ts";
import { E2E } from "../config.ts";
import { Finish, RegisterPerson } from "./dashboard-admin-support.ts";

after(CloseBrowser);

/** The reset link of the latest reset email sent to `email`, pointed at the app under test. */
async function ResetLinkFor(email: string): Promise<string> {
  const message = (await Outbox()).findLast((m) => m.to.email === email && m.text.includes("/redefinir-senha?token="));
  const link = message?.text.match(/https?:\/\/\S+\/redefinir-senha\?token=\S+/)?.[0];
  if (link === undefined) throw new Error(`no password reset email for ${email}`);
  return link.replace(/^https?:\/\/[^/]+/, WEB);
}

/** Status code of a login attempt through the API. */
async function LoginStatus(email: string, password: string): Promise<number> {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.status;
}

describe("Público: esqueci minha senha", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`do login ao link do e-mail, nova senha e entrada com ela; o link vale uma vez (${viewport})`, async () => {
      const { orgA } = await State();
      const email = `senha.${viewport}.${Date.now().toString(36)}@e2e.test`;
      await RegisterPerson(orgA.id, "Sonia", "Senha", email);

      const opened = await OpenPage(viewport);
      const { page } = opened;
      await page.goto(`${WEB}/entrar`);
      await page.getByRole("link", { name: "Esqueci minha senha" }).click();
      await page.waitForURL((url) => url.pathname === "/esqueci-senha");
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("button", { name: "Enviar link" }).click();
      await page.getByRole("status").filter({ hasText: "Se houver uma conta com esse e-mail, enviamos um link" }).waitFor();

      const link = await ResetLinkFor(email);
      await page.goto(link);
      await page.getByLabel("Nova senha", { exact: true }).fill("senha-nova-123");
      await page.getByLabel("Repita a nova senha").fill("senha-nova-123");
      await page.getByRole("button", { name: "Salvar nova senha" }).click();
      await page.waitForURL((url) => url.pathname === "/entrar" && url.searchParams.get("senhaRedefinida") === "1");
      await page.getByRole("status").filter({ hasText: "Senha alterada. Entre com a nova senha." }).waitFor();

      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill("senha-nova-123");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/");
      assert.equal(await LoginStatus(email, E2E.password), 401, "the old password still works");

      await page.goto(link);
      await page.getByLabel("Nova senha", { exact: true }).fill("outra-senha-123");
      await page.getByLabel("Repita a nova senha").fill("outra-senha-123");
      await page.getByRole("button", { name: "Salvar nova senha" }).click();
      await page.getByRole("alert").filter({ hasText: "Este link é inválido, expirou ou já foi usado." }).waitFor();
      await page.getByRole("link", { name: "Pedir um novo link" }).waitFor();

      await Finish(opened, viewport === "mobile", [
        "console: Failed to load resource: the server responded with a status of 400 (Bad Request)",
      ]);
    });
  }

  test("um e-mail sem conta recebe a mesma resposta e nenhum e-mail é enviado", async () => {
    const email = `ninguem.${Date.now().toString(36)}@e2e.test`;
    const opened = await OpenPage("desktop");
    await opened.page.goto(`${WEB}/esqueci-senha`);
    await opened.page.getByLabel("E-mail").fill(email);
    await opened.page.getByRole("button", { name: "Enviar link" }).click();
    await opened.page.getByRole("status").filter({ hasText: "Se houver uma conta com esse e-mail, enviamos um link" }).waitFor();
    assert.equal((await Outbox()).some((m) => m.to.email === email), false);
    await Finish(opened, false);
  });
});
