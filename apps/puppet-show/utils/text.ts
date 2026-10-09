/**
 * Text helpers for people's names.
 *
 * @module
 */

/** `"mARIA  da silva"` → `"Maria Da Silva"`: trims, collapses spaces and capitalizes each word. */
export function FormatPersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

/**
 * The sign-up form asks for one full name; the API wants first and last:
 * `"Maria da Silva"` → `{ firstName: "Maria", lastName: "da Silva" }`. A single
 * word gives an empty last name.
 */
export function SplitName(name: string): { firstName: string; lastName: string } {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  return { firstName: words.length === 0 ? "" : words[0], lastName: words.slice(1).join(" ") };
}

/**
 * Sorts by `name` the way a Portuguese reader expects (accents and case don't
 * change the order). Returns a new array.
 */
export function SortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}
