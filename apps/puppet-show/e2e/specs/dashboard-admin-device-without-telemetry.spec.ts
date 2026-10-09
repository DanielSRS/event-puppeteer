/**
 * A device that was approved but never sent telemetry: its page must load and
 * say so, not report an error. The API used to answer this case with an empty
 * body (a bare `null`), which the page showed as "formato inesperado".
 *
 * @module
 */

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { Api, CloseBrowser, LoginAs, OpenPage, State } from "../support.ts";
import { Finish, OpenAdminPage } from "./dashboard-admin-support.ts";

after(CloseBrowser);

describe("Painel admin: dispositivo sem telemetria", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    test(`a página do dispositivo carrega e explica que ainda não há telemetria (${viewport})`, async () => {
      const { orgA } = await State();
      const connected = (await Api(null, "POST", "/devices/connect", {
        identifier: `sem-telemetria-${viewport}-${Date.now()}`,
        organizationId: orgA.id,
      })) as { device: { id: string } };
      await Api("admin", "POST", `/devices/${connected.device.id}/approve`, { name: `Totem novo ${viewport}`, location: "Portaria" });

      const opened = await OpenPage(viewport);
      await LoginAs(opened.page, "admin");
      const main = await OpenAdminPage(opened.page, `/dashboard/devices/${connected.device.id}`, "Dispositivo");

      await main.getByText("O dispositivo ainda não enviou telemetria.", { exact: false }).waitFor();
      assert.equal(await main.getByRole("alert").count(), 0, "the page shows an error");
      await Finish(opened, viewport === "mobile");
    });
  }
});
