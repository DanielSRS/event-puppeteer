/**
 * Pieces of an organization's palette for places that show another
 * organization than the current one (e.g. the Superadmin's list), where the
 * page-wide `--org` doesn't apply. Same formulas as `globals.css`.
 *
 * @module
 */

/** The organization's gradient (its hue plus two neighbours) over the page background. */
export function OrgGradient(color: string): string {
  const stop = (lightness: number, chroma: number, shift: number) =>
    `color-mix(in oklab, oklch(from ${color} ${lightness} min(c, ${chroma}) calc(h + ${shift})) 70%, var(--bg))`;
  return [
    `radial-gradient(80% 120% at 0% 0%, ${stop(0.62, 0.17, 0)}, transparent 75%)`,
    `radial-gradient(70% 120% at 100% 20%, ${stop(0.58, 0.15, 62)}, transparent 75%)`,
    `radial-gradient(90% 140% at 60% 120%, ${stop(0.52, 0.13, -74)}, transparent 75%)`,
    "var(--bg)",
  ].join(", ");
}

/** Black or white, whichever reads on `color` (same rule as `--on-accent`). */
export function OrgInk(color: string): string {
  return `oklch(from ${color} clamp(0, (0.58 - l) * 1000, 1) 0 0)`;
}
