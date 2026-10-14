/**
 * Short initials for an organization or person, shown in a tile when there is
 * no logo or photo.
 *
 * @module
 */

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);

/**
 * Up to `max` letters: an acronym already in the name ("UEFS") is kept,
 * otherwise the first letter of the first words, skipping "de", "da"…
 */
export function Monogram(name: string, max = 4): string {
  const words = name.trim().split(/\s+/).filter((word) => word !== "");
  const acronym = words.find((word) => word.length >= 2 && word.length <= max && word === word.toUpperCase() && /\p{L}/u.test(word));
  if (acronym !== undefined) return acronym;
  const initials = words
    .filter((word) => !SMALL_WORDS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return initials === "" ? "?" : initials;
}
