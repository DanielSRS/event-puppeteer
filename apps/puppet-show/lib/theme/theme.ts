/**
 * Light/dark theme and the organization's color, remembered per browser.
 *
 * The root layout runs `THEME_INIT_SCRIPT` before the first paint so the page
 * never flashes the wrong theme or color; React code then changes them with
 * `ApplyTheme` and `ApplyOrgColor`.
 *
 * @module
 */

/** What the person picked; "system" follows the operating system. */
export type ThemePreference = "light" | "dark" | "system";

/** The theme actually shown. */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "mural:theme";
export const ORG_COLOR_STORAGE_KEY = "mural:org-color";

/** Brand color used when the organization has none (and for the Superadmin). */
export const DEFAULT_ORG_COLOR = "#f59e0b";

/** Paths that always use the dark theme (the TV display keeps its own look). */
export const DARK_ONLY_PATHS = ["/display"];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Whether `value` is a `#rgb` or `#rrggbb` color (the format of `Organization.colorScheme`). */
export function IsHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function Read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function Write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

/** The stored preference, "system" when there is none. */
export function StoredThemePreference(): ThemePreference {
  const value = Read(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

/** The theme a preference resolves to right now. */
export function ResolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const THEME_EVENT = "mural:theme-change";

/** Calls `onChange` whenever the preference changes (here or in another tab). */
export function SubscribeTheme(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Shows and remembers a theme preference. */
export function ApplyTheme(preference: ThemePreference): void {
  Write(THEME_STORAGE_KEY, preference);
  if (!DARK_ONLY_PATHS.includes(window.location.pathname)) {
    document.documentElement.dataset.theme = ResolveTheme(preference);
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Paints the app with the organization's color (the default one when `color` isn't valid) and remembers it. */
export function ApplyOrgColor(color: string | null | undefined): void {
  const value = IsHexColor(color) ? color : DEFAULT_ORG_COLOR;
  document.documentElement.style.setProperty("--org", value);
  Write(ORG_COLOR_STORAGE_KEY, value);
}

/**
 * Runs in <head> before the page paints: picks the theme (dark on the TV
 * display) and the last organization color. Kept dependency-free and tiny.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),c=localStorage.getItem(${JSON.stringify(ORG_COLOR_STORAGE_KEY)});
var dark=${JSON.stringify(DARK_ONLY_PATHS)}.indexOf(location.pathname)>=0;
var t=dark?"dark":(p==="light"||p==="dark")?p:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
d.dataset.theme=t;
if(c&&${HEX_COLOR.toString()}.test(c))d.style.setProperty("--org",c);
}catch(e){}})();`;
