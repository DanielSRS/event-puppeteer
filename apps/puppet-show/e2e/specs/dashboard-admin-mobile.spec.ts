/**
 * Every admin page on a phone (iPhone 13): it loads its data without page
 * errors and never scrolls sideways. The flows themselves are covered on
 * desktop by `dashboard-admin-flows.spec.ts`.
 *
 * @module
 */

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CloseBrowser, LoginAs, OpenPage, State, type Role } from "../support.ts";
import { ADMIN_PATHS, Finish, OpenAdminPage, WarmUp } from "./dashboard-admin-support.ts";

after(CloseBrowser);

/** Pages each role opens, with their headings. */
const PAGES: Array<{ role: Role; pages: Array<[path: string, heading: string]> }> = [
  {
    role: "admin",
    pages: [
      ["/dashboard/reports", "Denúncias"],
      ["/dashboard/bans", "Usuários Banidos"],
      ["/dashboard/tags", "Tags Sugeridas"],
      ["/dashboard/audit", "Auditoria"],
      ["/dashboard/users", "Usuários"],
      ["/dashboard/devices", "Dispositivos"],
      ["/dashboard/settings", "Configurações"],
    ],
  },
  {
    role: "superadmin",
    pages: [
      ["/dashboard/global/orgs", "Organizações"],
      ["/dashboard/global/devices", "Dispositivos Órfãos"],
      ["/dashboard/global/tags", "Tags Globais"],
      ["/dashboard/global/links", "Rótulos de Links"],
    ],
  },
];

describe("Painel admin: páginas no celular", () => {
  before(() => WarmUp(ADMIN_PATHS));

  for (const { role, pages } of PAGES) {
    for (const [path, heading] of pages) {
      test(`${role}: ${heading} carrega sem erros e sem rolagem lateral`, async () => {
        const tp = await OpenPage("mobile");
        await LoginAs(tp.page, role, path);
        const main = await OpenAdminPage(tp.page, path, heading);
        assert.equal(await main.getByRole("alert").count(), 0, `${path} shows an error`);
        await Finish(tp, true);
      });
    }
  }

  test("admin: página do dispositivo ativo carrega sem erros e sem rolagem lateral", async () => {
    const { activeDeviceId } = await State();
    const path = `/dashboard/devices/${activeDeviceId}`;
    const tp = await OpenPage("mobile");
    await LoginAs(tp.page, "admin", path);
    const main = await OpenAdminPage(tp.page, path, "Dispositivo");
    await main.getByRole("region", { name: "Hardware" }).waitFor();
    await Finish(tp, true);
  });
});
