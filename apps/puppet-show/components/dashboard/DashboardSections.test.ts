/**
 * Who may open which dashboard section, checked against the API's rules.
 *
 * @module
 */

import { describe, expect, test } from "vitest";
import { AccessibleSections, CanAccess, SectionDenialFor, SectionForPath, type DashboardSection } from "./DashboardSections";

const ORG = "org-a";

/** Labels of the sections a role sees in a context, in navigation order. */
function Labels(role: "Superadmin" | "Admin" | "Moderator" | "Member", orgId: string | null): string[] {
  return AccessibleSections({ role }, orgId).map((section) => section.label);
}

describe("AccessibleSections", () => {
  test("a member only manages their own events", () => {
    expect(Labels("Member", ORG)).toEqual(["Meus Eventos"]);
  });

  test("a moderator adds reports, bans, suggested tags and Image Review, but not the audit trail", () => {
    expect(Labels("Moderator", ORG)).toEqual(["Meus Eventos", "Denúncias", "Imagens em Revisão", "Usuários Banidos", "Tags Sugeridas"]);
  });

  test("an admin sees every organization section", () => {
    expect(Labels("Admin", ORG)).toEqual([
      "Meus Eventos", "Denúncias", "Imagens em Revisão", "Usuários Banidos", "Tags Sugeridas",
      "Auditoria", "Usuários", "Dispositivos", "Configurações",
    ]);
  });

  test("a Superadmin inside an organization sees what an admin sees there", () => {
    expect(Labels("Superadmin", ORG)).toEqual(Labels("Admin", ORG));
  });

  test("a Superadmin in the global context sees only the global sections", () => {
    expect(Labels("Superadmin", null)).toEqual([
      "Organizações", "Dispositivos Órfãos", "Tags Globais", "Links Globais", "Imagens Escalonadas", "Política de Triagem",
    ]);
  });
});

describe("CanAccess / SectionDenialFor", () => {
  const cases: Array<[DashboardSection, "Superadmin" | "Admin" | "Moderator" | "Member", string | null, ReturnType<typeof SectionDenialFor>]> = [
    ["audit", "Moderator", ORG, "role"],
    ["audit", "Admin", ORG, null],
    ["reports", "Member", ORG, "role"],
    ["reports", "Moderator", ORG, null],
    ["global-orgs", "Admin", ORG, "role"],
    ["global-orgs", "Superadmin", ORG, "needs-global"],
    ["global-orgs", "Superadmin", null, null],
    ["events", "Superadmin", null, "needs-org"],
    ["settings", "Superadmin", ORG, null],
    ["images", "Member", ORG, "role"],
    ["images", "Moderator", ORG, null],
    ["global-images", "Superadmin", null, null],
    ["global-screening", "Admin", ORG, "role"],
  ];

  test.each(cases)("%s for %s in %s → %s", (section, role, orgId, denial) => {
    expect(SectionDenialFor(section, { role }, orgId)).toBe(denial);
    expect(CanAccess(section, { role }, orgId)).toBe(denial === null);
  });
});

describe("SectionForPath", () => {
  test("maps a section page and the pages below it", () => {
    expect(SectionForPath("/dashboard/events")).toBe("events");
    expect(SectionForPath("/dashboard/devices/abc")).toBe("devices");
  });

  test("prefers the longest route, so global devices aren't organization devices", () => {
    expect(SectionForPath("/dashboard/global/devices")).toBe("global-devices");
  });

  test("doesn't match a route that only shares a prefix", () => {
    expect(SectionForPath("/dashboard/eventsx")).toBeNull();
  });

  test("the dashboard root is not a section", () => {
    expect(SectionForPath("/dashboard")).toBeNull();
  });
});
