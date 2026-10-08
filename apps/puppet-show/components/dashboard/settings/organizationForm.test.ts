import { describe, expect, test } from "vitest";
import type { Organization } from "@/lib/api/schemas";
import {
  CANNOT_CLEAR_MESSAGE, EmptyOrganizationForm, IsHttpUrl, OrganizationChanges, OrganizationToForm, ParseCoordinate,
  ParseThreshold, ToSlug, ValidateOrganizationForm, type OrganizationFormValues,
} from "./organizationForm";

const ORG: Organization = {
  id: "o1", name: "Universidade Estadual", slug: "uefs", description: "Campus", url: "https://uefs.br",
  latitude: -12.2, longitude: -38.97, shadowBanThreshold: 5, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

/** A valid form with some fields replaced. */
function form(fields: Partial<OrganizationFormValues> = {}): OrganizationFormValues {
  return { ...EmptyOrganizationForm(), name: "Universidade Estadual", slug: "uefs", ...fields };
}

describe("ToSlug", () => {
  test("lowercase, no accents, hyphens", () => expect(ToSlug("  Organização  Ação Já! ")).toBe("organizacao-acao-ja"));
});

describe("small parsers", () => {
  test("IsHttpUrl", () => {
    expect(IsHttpUrl("https://uefs.br/logo.png")).toBe(true);
    expect(IsHttpUrl("uefs.br")).toBe(false);
    expect(IsHttpUrl("ftp://uefs.br")).toBe(false);
    expect(IsHttpUrl("https://")).toBe(false);
  });

  test("ParseCoordinate accepts dot or comma within range", () => {
    expect(ParseCoordinate("-12,25", 90)).toBe(-12.25);
    expect(ParseCoordinate("45.5", 90)).toBe(45.5);
    expect(ParseCoordinate("91", 90)).toBeNull();
    expect(ParseCoordinate("abc", 90)).toBeNull();
  });

  test("ParseThreshold wants an integer of at least 1", () => {
    expect(ParseThreshold("3")).toBe(3);
    expect(ParseThreshold("")).toBeNull();
    expect(ParseThreshold("0")).toBeNull();
    expect(ParseThreshold("2.5")).toBeNull();
    expect(ParseThreshold("-1")).toBeNull();
  });
});

describe("ValidateOrganizationForm", () => {
  test("minimal valid form leaves empty optional fields out", () => {
    expect(ValidateOrganizationForm(form(), { takenSlugs: [] })).toEqual({ ok: true, value: { name: "Universidade Estadual", slug: "uefs", shadowBanThreshold: 5 } });
  });

  test("every field filled", () => {
    const result = ValidateOrganizationForm(form({
      description: " Campus ", logo: "https://x.org/l.png", url: "https://x.org", colorScheme: "#2563eb",
      location: "Feira de Santana", latitude: "-12,2", longitude: "-38.97", shadowBanThreshold: "2",
    }), { takenSlugs: [] });
    expect(result).toEqual({ ok: true, value: {
      name: "Universidade Estadual", slug: "uefs", shadowBanThreshold: 2, description: "Campus", logo: "https://x.org/l.png",
      url: "https://x.org", colorScheme: "#2563eb", location: "Feira de Santana", latitude: -12.2, longitude: -38.97,
    } });
  });

  test("reports each problem on its field", () => {
    const result = ValidateOrganizationForm(form({
      name: "U", slug: "Com Espaço", logo: "logo.png", url: "x", colorScheme: "azul", latitude: "100", shadowBanThreshold: "",
    }), { takenSlugs: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.error).sort()).toEqual(["colorScheme", "latitude", "logo", "longitude", "name", "shadowBanThreshold", "slug", "url"]);
    expect(result.error.longitude).toBe("Informe a longitude junto com a latitude.");
  });

  test("a slug already used by another organization is refused", () => {
    const result = ValidateOrganizationForm(form(), { takenSlugs: ["uefs"] });
    expect(result).toEqual({ ok: false, error: { slug: "Já existe uma organização com esse identificador." } });
  });
});

describe("OrganizationChanges", () => {
  /** Validates the form of ORG after `edit`, then diffs it. */
  function changes(edit: Partial<OrganizationFormValues>) {
    const body = ValidateOrganizationForm({ ...OrganizationToForm(ORG), ...edit }, { takenSlugs: [] });
    if (!body.ok) throw new Error("form should be valid");
    return OrganizationChanges(ORG, body.value);
  }

  test("nothing changed", () => expect(changes({})).toEqual({ ok: true, value: {} }));

  test("only what changed, threshold included only when changed", () => {
    expect(changes({ name: "UEFS", location: "Feira" })).toEqual({ ok: true, value: { name: "UEFS", location: "Feira" } });
    expect(changes({ shadowBanThreshold: "2" })).toEqual({ ok: true, value: { shadowBanThreshold: 2 } });
  });

  test("emptying a field that had a value is refused", () => {
    expect(changes({ description: "" })).toEqual({ ok: false, error: { description: CANNOT_CLEAR_MESSAGE } });
  });
});
