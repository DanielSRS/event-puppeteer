/**
 * Rules of the organization form, shared by the Superadmin's organization
 * editor and the Admin's settings page.
 *
 * The form keeps every field as text; {@link ValidateOrganizationForm} turns
 * it into the API body or says, per field, what is wrong. When editing,
 * {@link OrganizationChanges} keeps only what changed, so saving the profile
 * doesn't record a threshold change in the audit trail when the threshold
 * stayed the same.
 *
 * @module
 */

import type { Organization, OrganizationInput } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";

/** Every field of the form, as typed. */
export type OrganizationFormValues = {
  name: string;
  slug: string;
  description: string;
  url: string;
  colorScheme: string;
  location: string;
  latitude: string;
  longitude: string;
  shadowBanThreshold: string;
};

export type OrganizationFormField = keyof OrganizationFormValues;

/** What is wrong with each field (fields without a problem are absent). */
export type OrganizationFormErrors = Partial<Record<OrganizationFormField, string>>;

/** Fields the API may leave out (everything but name, slug and threshold). */
const OPTIONAL_FIELDS = ["description", "url", "colorScheme", "location", "latitude", "longitude"] as const;

/** An empty form for a new organization. The threshold starts at the API's own default (5). */
export function EmptyOrganizationForm(): OrganizationFormValues {
  return {
    name: "", slug: "", description: "", url: "", colorScheme: "",
    location: "", latitude: "", longitude: "", shadowBanThreshold: "5",
  };
}

/** The form filled with an existing organization; absent optional fields are empty. */
export function OrganizationToForm(org: Organization): OrganizationFormValues {
  return {
    name: org.name,
    slug: org.slug,
    description: org.description === undefined ? "" : org.description,
    url: org.url === undefined ? "" : org.url,
    colorScheme: org.colorScheme === undefined ? "" : org.colorScheme,
    location: org.location === undefined ? "" : org.location,
    latitude: org.latitude === undefined ? "" : String(org.latitude),
    longitude: org.longitude === undefined ? "" : String(org.longitude),
    shadowBanThreshold: String(org.shadowBanThreshold),
  };
}

/** `"Universidade Estadual"` → `"universidade-estadual"`. */
export function ToSlug(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Lowercase letters and digits in groups separated by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `#rrggbb`. */
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Whether `text` is an absolute http(s) URL. */
export function IsHttpUrl(text: string): boolean {
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    const url = new URL(text);
    return url.hostname !== "";
  } catch {
    return false;
  }
}

/** Parses a coordinate typed with a dot or a comma; `null` when it isn't a number in `[-limit, limit]`. */
export function ParseCoordinate(text: string, limit: number): number | null {
  if (!/^-?\d+(?:[.,]\d+)?$/.test(text)) return null;
  const value = Number(text.replace(",", "."));
  return Math.abs(value) <= limit ? value : null;
}

/** Parses the threshold; `null` unless it is an integer of at least 1. */
export function ParseThreshold(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value >= 1 && Number.isSafeInteger(value) ? value : null;
}

/** Options of {@link ValidateOrganizationForm}. */
export type ValidationOptions = {
  /** Slugs of the other organizations (a new slug can't repeat one). */
  takenSlugs: readonly string[];
};

/**
 * Validates the whole form and builds the body of `POST /organizations`.
 * Empty optional fields are left out of the body.
 */
export function ValidateOrganizationForm(values: OrganizationFormValues, options: ValidationOptions): Result<OrganizationInput, OrganizationFormErrors> {
  const errors: OrganizationFormErrors = {};
  const name = values.name.trim();
  const slug = values.slug.trim();
  const url = values.url.trim();
  const colorScheme = values.colorScheme.trim();
  const latitudeText = values.latitude.trim();
  const longitudeText = values.longitude.trim();

  if (name.length < 2) errors.name = "Informe o nome (pelo menos 2 caracteres).";

  if (slug === "") errors.slug = "Informe o identificador.";
  else if (!SLUG_PATTERN.test(slug)) errors.slug = "Use apenas letras minúsculas sem acento, números e hífens entre eles (ex.: universidade-estadual).";
  else if (options.takenSlugs.includes(slug)) errors.slug = "Já existe uma organização com esse identificador.";

  if (url !== "" && !IsHttpUrl(url)) errors.url = "Informe um endereço completo começando com http:// ou https://.";
  if (colorScheme !== "" && !COLOR_PATTERN.test(colorScheme)) errors.colorScheme = "Use o formato #rrggbb (ex.: #2563eb).";

  const latitude = latitudeText === "" ? null : ParseCoordinate(latitudeText, 90);
  const longitude = longitudeText === "" ? null : ParseCoordinate(longitudeText, 180);
  if (latitudeText !== "" && latitude === null) errors.latitude = "Latitude deve ser um número entre -90 e 90.";
  if (longitudeText !== "" && longitude === null) errors.longitude = "Longitude deve ser um número entre -180 e 180.";
  if (latitudeText === "" && longitudeText !== "") errors.latitude = "Informe a latitude junto com a longitude.";
  if (longitudeText === "" && latitudeText !== "") errors.longitude = "Informe a longitude junto com a latitude.";

  const threshold = ParseThreshold(values.shadowBanThreshold);
  if (threshold === null) errors.shadowBanThreshold = "Informe um número inteiro de denúncias, a partir de 1.";

  if (Object.keys(errors).length > 0 || threshold === null) return Err(errors);

  const body: OrganizationInput = { name, slug, shadowBanThreshold: threshold };
  const description = values.description.trim();
  const location = values.location.trim();
  if (description !== "") body.description = description;
  if (url !== "") body.url = url;
  if (colorScheme !== "") body.colorScheme = colorScheme;
  if (location !== "") body.location = location;
  if (latitude !== null) body.latitude = latitude;
  if (longitude !== null) body.longitude = longitude;
  return Ok(body);
}

/** Message for an optional field that had a value and was emptied. */
export const CANNOT_CLEAR_MESSAGE = "A API ainda não permite apagar este campo depois de preenchido. Informe um valor.";

/**
 * What changed between `original` and a validated `body`, as the body of
 * `PATCH /organizations/:id` (empty when nothing changed). Emptying an optional
 * field that had a value is refused: the API can only set values, not remove them.
 */
export function OrganizationChanges(original: Organization, body: OrganizationInput): Result<Partial<OrganizationInput>, OrganizationFormErrors> {
  const errors: OrganizationFormErrors = {};
  for (const field of OPTIONAL_FIELDS)
    if (original[field] !== undefined && body[field] === undefined) errors[field] = CANNOT_CLEAR_MESSAGE;
  if (Object.keys(errors).length > 0) return Err(errors);

  const changes: Partial<OrganizationInput> = {};
  if (body.name !== original.name) changes.name = body.name;
  if (body.slug !== original.slug) changes.slug = body.slug;
  if (body.shadowBanThreshold !== original.shadowBanThreshold) changes.shadowBanThreshold = body.shadowBanThreshold;
  if (body.description !== original.description) changes.description = body.description;
  if (body.url !== original.url) changes.url = body.url;
  if (body.colorScheme !== original.colorScheme) changes.colorScheme = body.colorScheme;
  if (body.location !== original.location) changes.location = body.location;
  if (body.latitude !== original.latitude) changes.latitude = body.latitude;
  if (body.longitude !== original.longitude) changes.longitude = body.longitude;
  return Ok(changes);
}
