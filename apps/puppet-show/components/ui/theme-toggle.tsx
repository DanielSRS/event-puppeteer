/**
 * Light / dark / system theme picker, and the component that keeps the theme
 * in sync while navigating.
 *
 * @module
 */

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MdBrightnessAuto, MdDarkMode, MdLightMode } from "react-icons/md";
import type { IconType } from "react-icons";
import {
  ApplyTheme,
  DARK_ONLY_PATHS,
  ResolveTheme,
  StoredThemePreference,
  SubscribeTheme,
  type ThemePreference,
} from "@/lib/theme/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: IconType }[] = [
  { value: "light", label: "Claro", icon: MdLightMode },
  { value: "dark", label: "Escuro", icon: MdDarkMode },
  { value: "system", label: "Sistema", icon: MdBrightnessAuto },
];

export type ThemeToggleProps = {
  /** Icons only (names stay available to screen readers). */
  compact?: boolean;
  className?: string;
};

/** Segmented control; each option is a toggle button (`aria-pressed`). */
export function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  // `null` on the server, which doesn't know the stored preference.
  const preference = useSyncExternalStore<ThemePreference | null>(SubscribeTheme, StoredThemePreference, () => null);

  return (
    <div role="group" aria-label="Tema" className={`segmented ${className}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="focus-ring"
          aria-pressed={preference === option.value}
          aria-label={compact ? `Tema ${option.label.toLowerCase()}` : undefined}
          title={compact ? `Tema ${option.label.toLowerCase()}` : undefined}
          onClick={() => ApplyTheme(option.value)}
        >
          <option.icon aria-hidden className="w-4 h-4" />
          {!compact && option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Keeps `data-theme` right after client-side navigation (the TV display is
 * always dark) and follows the operating system when the preference is "system".
 */
export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      root.dataset.theme = DARK_ONLY_PATHS.includes(pathname) ? "dark" : ResolveTheme(StoredThemePreference());
    };
    update();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", update);
    const unsubscribe = SubscribeTheme(update);
    return () => {
      media.removeEventListener("change", update);
      unsubscribe();
    };
  }, [pathname]);

  return null;
}
