/**
 * Formatting of API timestamps (ISO instants) for the admin pages.
 *
 * Always in Brazil's time zone, so the text doesn't depend on where the
 * browser (or the test runner) is.
 *
 * @module
 */

/** Time zone every admin screen shows times in. */
const TIME_ZONE = "America/Sao_Paulo";

/**
 * `"2026-10-07T15:04:00.000Z"` → `"07/10/2026, 12:04"`.
 * Text that isn't a valid instant is returned unchanged, so a bad value stays visible instead of becoming "Invalid Date".
 */
export function FormatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

/** `"2026-10-07T15:04:00.000Z"` → `"07/10/2026"`; invalid text is returned unchanged. */
export function FormatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR", { timeZone: TIME_ZONE });
}
