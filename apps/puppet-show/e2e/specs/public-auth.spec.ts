/**
 * Login and sign-up against the real API, including the emailed confirmation
 * link opened end to end, and the top bar on phones and desktops.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, HasHorizontalScroll, LoginAs, OpenPage, Outbox, WEB } from "../support.ts";
import { E2E } from "../config.ts";

after(CloseBrowser);

/** Console lines browsers print for an expected non-2xx answer. */
function Unexpected(errors: string[], statuses: number[]): string[] {
  return errors.filter((error) => !statuses.some((status) => error.includes(`status of ${status}`)));
}

describe("Público: login e cadastro", () => {
  test("senha errada diz que e-mail ou senha estão incorretos", async () => {
    const { page, context, errors } = await OpenPage("mobile");
    await page.goto(`${WEB}/entrar`);
    await page.getByLabel("E-mail").fill(E2E.users.member);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." }).waitFor();
    assert.equal(await HasHorizontalScroll(page), false);
    assert.deepEqual(Unexpected(errors, [401]), []);
    await context.close();
  });

  test("cadastro novo: login bloqueado até abrir o link do e-mail, depois funciona e volta ao destino", async () => {
    const email = `novo.${Date.now()}@e2e.test`;
    const { page, context, errors } = await OpenPage("mobile");

    await page.goto(`${WEB}/cadastro?redirect=${encodeURIComponent("/display")}`);
    await page.getByLabel("Nome completo").fill("nina nova");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(E2E.password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.getByRole("heading", { name: "Confirme seu e-mail" }).waitFor();
    await page.getByText(email).waitFor();

    await page.goto(`${WEB}/entrar?redirect=${encodeURIComponent("/eventos/novo")}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(E2E.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Seu e-mail ainda não foi confirmado." }).waitFor();
    const before = (await Outbox()).filter((message) => message.to.email === email).length;
    await page.getByRole("button", { name: "Reenviar e-mail de confirmação" }).click();
    await page.getByRole("status").filter({ hasText: "um novo link de confirmação foi enviado" }).waitFor();
    assert.equal((await Outbox()).filter((message) => message.to.email === email).length, before + 1);

    const message = (await Outbox()).findLast((m) => m.to.email === email);
    const link = message?.text.match(/https?:\/\/\S+verify-email\?token=\S+/)?.[0];
    assert.ok(link, "verification email has a link");
    await page.goto(link.replace(/^https?:\/\/[^/]+/, `http://localhost:${E2E.apiPort}`));
    await page.waitForURL((url) => url.pathname === "/entrar" && url.searchParams.get("emailVerified") === "1");
    await page.getByRole("status").filter({ hasText: "E-mail confirmado, faça login." }).waitFor();

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(E2E.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.getByRole("button", { name: "Abrir navegação" }).click();
    await page.locator("p", { hasText: "Olá, Nina" }).waitFor();

    assert.deepEqual(Unexpected(errors, [403]), []);
    await context.close();
  });

  test("e-mail já cadastrado é explicado", async () => {
    const { page, context, errors } = await OpenPage("desktop");
    await page.goto(`${WEB}/cadastro`);
    await page.getByLabel("Nome completo").fill("Maria Repetida");
    await page.getByLabel("E-mail").fill(E2E.users.member);
    await page.getByLabel("Senha").fill(E2E.password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.getByRole("alert").filter({ hasText: "Este e-mail já está cadastrado." }).waitFor();
    assert.deepEqual(Unexpected(errors, [400]), []);
    await context.close();
  });
});

describe("Público: navegação", () => {
  test("menu do celular abre, navega pelo teclado e fecha com Escape", async () => {
    const { page, context, errors } = await OpenPage("mobile");
    await page.goto(`${WEB}/`);
    const button = page.getByRole("button", { name: "Abrir navegação" });
    assert.equal(await button.getAttribute("aria-expanded"), "false");

    await button.focus();
    await page.keyboard.press("Enter");
    const close = page.getByRole("button", { name: "Fechar navegação" });
    assert.equal(await close.getAttribute("aria-expanded"), "true");

    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    assert.equal(focused, "Mural");
    for (const name of ["Modo TV", "Entrar", "Criar conta"]) assert.ok(await page.getByRole("link", { name, exact: true }).isVisible(), name);

    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Abrir navegação" }).getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Abrir navegação");
    assert.equal(await page.getByRole("link", { name: "Modo TV" }).isVisible(), false);

    await page.getByRole("button", { name: "Abrir navegação" }).click();
    await page.getByRole("link", { name: "Modo TV" }).click();
    await page.waitForURL(`${WEB}/display`);

    assert.deepEqual(errors, []);
    await context.close();
  });

  test("logado no desktop: saudação, Painel, Publicar e Sair", async () => {
    const { page, context, errors } = await OpenPage("desktop");
    await LoginAs(page, "member");
    await page.getByText("Olá, Maria").first().waitFor();
    assert.equal(await page.getByRole("link", { name: "Painel" }).getAttribute("href"), "/dashboard");
    assert.equal(await page.getByRole("link", { name: "Publicar" }).getAttribute("href"), "/eventos/novo");
    assert.ok(await page.getByRole("link", { name: /Universidade Estadual/ }).isVisible());
    await page.getByRole("button", { name: "Sair" }).click();
    await page.getByRole("link", { name: "Entrar", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  });

  for (const path of ["/", "/entrar", "/cadastro", "/display"]) {
    test(`sem rolagem lateral no celular: ${path}`, async () => {
      const { page, context, errors } = await OpenPage("mobile");
      await page.goto(`${WEB}${path}`);
      await page.waitForLoadState("networkidle");
      assert.equal(await HasHorizontalScroll(page), false);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
});
