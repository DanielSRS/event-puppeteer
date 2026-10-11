/**
 * Promoting someone to Superadmin from the organization's user list: only a
 * Superadmin sees the action, it asks for confirmation, the promoted person
 * leaves the organization, logs in to the global context, and the change is in
 * the organization's audit trail.
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, LoginAs, OpenPage, State, WEB } from "../support.ts";
import { E2E } from "../config.ts";
import { Finish, OpenAdminPage, RegisterPerson } from "./dashboard-admin-support.ts";
import { SwitchContext } from "./dashboard-shell-support.ts";

after(CloseBrowser);

describe("Painel admin: promover a Superadmin", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`superadmin promove uma pessoa, que passa a entrar no contexto global; a auditoria registra (${viewport})`, async () => {
      const { orgA } = await State();
      const suffix = `${viewport}.${Date.now().toString(36)}`;
      const person = await RegisterPerson(orgA.id, "Pedro", `Promovido ${viewport}`, `pedro.${suffix}@e2e.test`);
      const name = `Pedro Promovido ${viewport}`;

      const asSuper = await OpenPage(viewport);
      await LoginAs(asSuper.page, "superadmin");
      await asSuper.page.goto(`${WEB}/dashboard`);
      await asSuper.page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");
      await SwitchContext(asSuper.page, viewport, orgA.name);
      const users = await OpenAdminPage(asSuper.page, "/dashboard/users", "Usuários");

      await users.getByRole("button", { name: `Promover ${name} a Superadmin` }).click();
      const dialog = asSuper.page.getByRole("alertdialog", { name: `Promover ${name} a Superadmin?` });
      await dialog.getByText("O painel não permite desfazer esta ação.").waitFor();
      await dialog.getByRole("button", { name: "Sim, promover" }).click();
      await users.getByRole("status").filter({ hasText: `${name} agora é Superadmin e saiu desta organização.` }).waitFor();
      assert.equal(await users.getByRole("rowheader", { name }).count(), 0, "the promoted person left the list");
      await Finish(asSuper, viewport === "mobile");

      const asPromoted = await OpenPage(viewport);
      await asPromoted.page.goto(`${WEB}/entrar?redirect=${encodeURIComponent("/dashboard")}`);
      await asPromoted.page.getByLabel("E-mail").fill(person.email);
      await asPromoted.page.getByLabel("Senha").fill(E2E.password);
      await asPromoted.page.getByRole("button", { name: "Entrar", exact: true }).click();
      await asPromoted.page.waitForURL((url) => url.pathname === "/dashboard/global/orgs");
      await asPromoted.page.getByRole("heading", { level: 1, name: "Organizações" }).waitFor();
      await Finish(asPromoted, viewport === "mobile");

      const asAdmin = await OpenPage(viewport);
      await LoginAs(asAdmin.page, "admin", "/dashboard/audit");
      const audit = await OpenAdminPage(asAdmin.page, "/dashboard/audit", "Auditoria");
      await audit.getByRole("rowheader", { name: "Papel alterado" }).first().waitFor();
      await audit.getByText("Novo papel: Superadmin.").first().waitFor();
      await Finish(asAdmin, viewport === "mobile");
    });
  }

  test("admin da organização não vê a ação de promover a Superadmin", async () => {
    const asAdmin = await OpenPage("desktop");
    await LoginAs(asAdmin.page, "admin", "/dashboard/users");
    const users = await OpenAdminPage(asAdmin.page, "/dashboard/users", "Usuários");
    await users.getByRole("rowheader", { name: /Maria Membro/ }).waitFor();
    assert.equal(await users.getByRole("button", { name: /a Superadmin/ }).count(), 0);
    await Finish(asAdmin, false);
  });
});
