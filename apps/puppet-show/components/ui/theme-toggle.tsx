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
 * Keeps `data-theme` right after client-side navigation and follows the
 * operating system when the preference is "system".
 */
export function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      root.dataset.theme = ResolveTheme(StoredThemePreference());
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

/** The theme shown right now ("dark" on the server). */
function ShownTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Re-reads the shown theme when the preference or the system theme changes. */
function SubscribeShownTheme(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const later = () => window.setTimeout(onChange, 0);
  media.addEventListener("change", later);
  const unsubscribe = SubscribeTheme(later);
  return () => {
    media.removeEventListener("change", later);
    unsubscribe();
  };
}

/** One icon button that switches between light and dark (the top bar's compact control). */
export function ThemeIconButton({ className = "" }: { className?: string }) {
  const shown = useSyncExternalStore(SubscribeShownTheme, ShownTheme, () => "dark" as const);
  const next = shown === "dark" ? "light" : "dark";
  const label = next === "light" ? "Usar tema claro" : "Usar tema escuro";
  const Icon = next === "light" ? MdLightMode : MdDarkMode;

  return (
    <button type="button" onClick={() => ApplyTheme(next)} aria-label={label} title={label} className={`button ghost icon-only ${className}`}>
      <Icon aria-hidden className="h-[19px] w-[19px]" />
    </button>
  );
}
