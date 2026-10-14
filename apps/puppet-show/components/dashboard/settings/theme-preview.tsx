/**
 * Two small previews of how a colour looks as an organization's palette, in
 * the dark and the light theme (background gradient, text and an accent
 * button), shown next to the "Cor principal" field.
 *
 * The page-wide tokens only follow the current organization, so the previews
 * apply the same formulas as `globals.css` to the colour being typed.
 *
 * @module
 */

import { OrgInk } from "@/lib/theme/org-palette";

/** Background, text and gradient stops of one theme for `color` (mirrors `globals.css`). */
function Palette(color: string, theme: "dark" | "light") {
  const c = (l: number, ch: string, shift = 0) => `oklch(from ${color} ${l} ${ch} calc(h + ${shift}))`;
  const dark = theme === "dark";
  const bg = dark ? c(0.15, "0.014") : c(0.975, "0.01");
  const fg = dark ? c(0.97, "0.006") : c(0.2, "0.02");
  const g1 = dark ? c(0.44, "min(c, 0.17)") : c(0.88, "min(c, 0.11)");
  const g2 = dark ? c(0.38, "min(c, 0.15)", 62) : c(0.9, "min(c, 0.09)", 62);
  const g3 = dark ? c(0.32, "min(c, 0.13)", -74) : c(0.87, "min(c, 0.08)", -74);
  const background = [
    `radial-gradient(80% 90% at 0% 0%, ${g1}, transparent 72%)`,
    `radial-gradient(70% 80% at 100% 10%, ${g2}, transparent 72%)`,
    `radial-gradient(90% 90% at 60% 110%, ${g3}, transparent 72%)`,
    bg,
  ].join(", ");
  return { background, fg };
}

/** One theme's preview tile. */
function Tile({ color, theme, label }: { color: string; theme: "dark" | "light"; label: string }) {
  const { background, fg } = Palette(color, theme);
  return (
    <div className="relative h-[132px] overflow-hidden rounded-2xl border border-[color:var(--line-2)]" style={{ background, color: fg }}>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="inline-flex min-h-[34px] items-center rounded-xl px-3 text-[13px] font-semibold" style={{ background: color, color: OrgInk(color) }}>
          Publicar
        </span>
      </div>
    </div>
  );
}

/** Dark and light previews of `color` side by side (stacked when narrow). */
export function ThemePreview({ color }: { color: string }) {
  return (
    <div
      role="img"
      aria-label={`Prévia da cor ${color} nos temas escuro e claro`}
      className="well grid gap-3 rounded-[20px] p-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]"
    >
      <Tile color={color} theme="dark" label="Escuro" />
      <Tile color={color} theme="light" label="Claro" />
    </div>
  );
}
