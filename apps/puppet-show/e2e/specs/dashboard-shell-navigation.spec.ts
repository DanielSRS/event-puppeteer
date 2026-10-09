/**
 * Dashboard shell against the real API: which sections each role sees in each
 * context, that every section opens without errors, the Superadmin's context
 * switch (mouse and keyboard) and its persistence, the `/dashboard` redirect,
 * the page guard and the login redirect. Desktop and phone.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, LoginAs, OpenPage, WEB, type Role } from "../support.ts";
import {
  AssertNoSideScroll, ManagedContext, OpenSection, SECTIONS, SectionLabels, SwitchContext,
} from "./dashboard-shell-support.ts";

after(CloseBrowser);

/** A role in a context, and the sections it must see. */
type Case = { name: string; role: Role; orgContext: boolean; sections: readonly string[] };

const CASES: Case[] = [
  { name: "superadmin no Sistema Global", role: "superadmin", orgContext: false, sections: SECTIONS.global },
  { name: "superadmin na Universidade Estadual", role: "superadmin", orgContext: true, sections: SECTIONS.admin },
  { name: "admin", role: "admin", orgContext: true, sections: SECTIONS.admin },
  { name: "moderador", role: "moderator", orgContext: true, sections: SECTIONS.moderator },
  { name: "membro", role: "member", orgContext: true, sections: SECTIONS.member },
];

for (const viewport of ["desktop", "mobile"] as const) {
  describe(`Painel: navegação por papel (${viewport})`, () => {
    for (const { name, role, orgContext, sections } of CASES) {
      test(`${name} vê exatamente as seções permitidas e todas abrem sem erro`, async () => {
        const { page, context, errors } = await OpenPage(viewport);
        await LoginAs(page, role);
        await page.goto(`${WEB}/dashboard`);
        await page.waitForURL((url) => url.pathname !== "/dashboard");

        if (role === "superadmin" && orgContext) {
          await SwitchContext(page, viewport, "Universidade Estadual");
          await page.waitForURL((url) => url.pathname === "/dashboard/events");
        }
        assert.equal(await ManagedContext(page), orgContext ? "Universidade Estadual" : "Sistema Global");
        assert.deepEqual(await SectionLabels(page, viewport), [...sections]);

        for (const label of sections) {
          await OpenSection(page, viewport, label);
          assert.equal(await page.getByText("Página indisponível").count(), 0, `${label} was guarded`);
          await AssertNoSideScroll(page, viewport);
        }

        assert.deepEqual(errors, []);
        await context.close();
      });
    }
  });

  describe(`Painel: contexto do superadmin (${viewport})`, () => {
    test("trocar de Sistema Global para a organização mostra as seções dela, a página acompanha e a escolha sobrevive ao recarregar", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "superadmin");
      await page.goto(`${WEB}/dashboard`);
      await page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");

      await SwitchContext(page, viewport, "Universidade Estadual");
      await page.waitForURL((url) => url.pathname === "/dashboard/events");
      await page.getByRole("heading", { name: "Meus Eventos" }).waitFor();
      assert.equal(await ManagedContext(page), "Universidade Estadual");
      assert.deepEqual(await SectionLabels(page, viewport), [...SECTIONS.admin]);

      await OpenSection(page, viewport, "Configurações");
      await page.reload();
      await page.getByRole("main").getByText("Gerenciando:").waitFor();
      assert.equal(await ManagedContext(page), "Universidade Estadual");
      assert.equal(new URL(page.url()).pathname, "/dashboard/settings");
      assert.equal(await page.getByText("Página indisponível").count(), 0);

      await SwitchContext(page, viewport, "Sistema Global");
      await page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");
      assert.deepEqual(await SectionLabels(page, viewport), [...SECTIONS.global]);

      await AssertNoSideScroll(page, viewport);
      assert.deepEqual(errors, []);
      await context.close();
    });

    test("o seletor de contexto funciona só com o teclado", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "superadmin");
      await page.goto(`${WEB}/dashboard`);
      await page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");

      if (viewport === "mobile") {
        await page.getByRole("button", { name: "Seções", exact: true }).focus();
        await page.keyboard.press("Enter");
      }
      const scope = viewport === "mobile" ? page.getByRole("dialog", { name: "Menu do painel" }) : page.locator("aside");
      const toggle = scope.getByRole("button", { name: /Contexto \(trocar\)/ });
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");

      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await toggle.evaluate((element) => element === document.activeElement), true);
      if (viewport === "mobile") assert.equal(await scope.isVisible(), true, "Escape on the switcher closed the menu panel");

      await page.keyboard.press("Enter");
      const options = scope.getByRole("list", { name: "Contextos disponíveis" });
      assert.equal(await options.getByRole("button", { name: "Sistema Global" }).getAttribute("aria-current"), "true");
      const target = options.getByRole("button", { name: "Universidade Estadual" });
      const optionCount = await options.getByRole("button").count();
      for (let step = 0; step < optionCount; step += 1) {
        await page.keyboard.press("Tab");
        if (await target.evaluate((element) => element === document.activeElement)) break;
      }
      assert.equal(await target.evaluate((element) => element === document.activeElement), true, "Tab never reached the org option");
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname === "/dashboard/events");
      if (viewport === "mobile") await page.keyboard.press("Escape");
      assert.equal(await ManagedContext(page), "Universidade Estadual");

      assert.deepEqual(errors, []);
      await context.close();
    });
  });

  describe(`Painel: entrada e proteção das páginas (${viewport})`, () => {
    test("/dashboard abre a primeira seção permitida", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "member");
      await page.goto(`${WEB}/dashboard`);
      await page.waitForURL((url) => url.pathname === "/dashboard/events");
      await page.getByRole("heading", { name: "Meus Eventos" }).waitFor();
      assert.equal(await ManagedContext(page), "Universidade Estadual");
      assert.deepEqual(errors, []);
      await context.close();
    });

    test("uma URL sem permissão digitada mostra o aviso, sem erro da API", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "moderator");
      await page.goto(`${WEB}/dashboard/audit`);
      await page.getByText("Você não tem permissão para acessar esta página.").waitFor();
      await page.getByRole("link", { name: "Ir para Meus Eventos" }).waitFor();

      await page.goto(`${WEB}/dashboard/global/orgs`);
      await page.getByText("Você não tem permissão para acessar esta página.").waitFor();

      await AssertNoSideScroll(page, viewport);
      assert.deepEqual(errors, []);
      await context.close();
    });

    test("superadmin no Sistema Global abrindo página de organização é orientado a escolher uma", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await LoginAs(page, "superadmin");
      await page.goto(`${WEB}/dashboard/reports`);
      await page.getByText(/Selecione uma organização no seletor de contexto/).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    });

    test("visitante sem sessão vai para o login e volta para a página pedida", async () => {
      const { page, context, errors } = await OpenPage(viewport);
      await page.goto(`${WEB}/dashboard/events`);
      await page.waitForURL((url) => url.pathname === "/entrar");
      assert.equal(new URL(page.url()).searchParams.get("redirect"), "/dashboard/events");
      assert.deepEqual(errors, []);
      await context.close();
    });
  });
}
