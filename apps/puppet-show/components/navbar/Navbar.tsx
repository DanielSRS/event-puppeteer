/**
 * The site's top bar: organization branding and the session.
 *
 * A floating glass bar. Visitors get a theme button, "Entrar" and "Criar
 * conta". Logged-in people get "Painel", "Publicar" and their avatar, which
 * opens an account menu (greeting, theme, "Sair"); on phones "Painel" and
 * "Publicar" move to a tab bar at the bottom of the screen, next to "Mural".
 *
 * @module
 */

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MdAdd, MdDashboard, MdEvent, MdLogout } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import { ThemeIconButton, ThemeToggle } from "@/components/ui/theme-toggle";
import type { AuthState } from "@/hooks/useAuth";
import type { ImageView, User } from "@/lib/api/schemas";
import { Monogram } from "@/utils/monogram";

/** The product's name, shown for the Superadmin (who belongs to no organization) and next to an org name. */
export const APP_NAME = "Mural de Eventos";

/** Organization shown in the bar; `logo` is `null` when it never had one. */
export type NavBrand = { name: string; logo: ImageView | null };

export type NavbarProps = {
  auth: AuthState;
  /** The viewer's organization (the public one for visitors); `null` for the Superadmin or while loading. */
  brand: NavBrand | null;
  /** Why the organization couldn't be loaded. */
  brandError: string | null;
  /** Current path, to mark the active link. */
  pathname: string;
  /** Why the last logout failed. */
  logoutError: string | null;
  onLogout: () => void;
  /** Called when the person shows intent to open a link (hover, focus, touch), to load its data beforehand. */
  onIntent?: (href: string) => void;
};

/** Pages with their own bottom action bar, where the phone tab bar would cover it. */
const TABLESS_PATHS = ["/eventos/novo"];

/** Whether `href` is the page being shown (sub-pages of the dashboard count). */
function IsCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Props that make a link load its page's data when the person shows intent to open it. */
function IntentProps(href: string, onIntent?: (href: string) => void) {
  return {
    onMouseEnter: () => onIntent?.(href),
    onFocus: () => onIntent?.(href),
    onTouchStart: () => onIntent?.(href),
  };
}

/** Avatar button and the account menu it discloses (Escape or a click outside closes it). */
function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {/* The initials are drawn by CSS (::before): the accessible name is the full "Sua conta: …". */}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Sua conta: ${fullName}`}
        onClick={() => setOpen((value) => !value)}
        data-initial={Monogram(fullName, 2)}
        className="avatar h-11 w-11 cursor-pointer text-sm focus-ring before:content-[attr(data-initial)]"
      />

      <div
        id={menuId}
        hidden={!open}
        className="glass-strong absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[22px] p-3"
      >
        <div className="column gap-3">
          <div className="column px-1 leading-tight">
            <p className="font-semibold">Olá, {user.firstName}</p>
            <span className="t3 truncate text-xs">{user.email}</span>
          </div>
          <ThemeToggle className="grid w-full grid-cols-3" />
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="button justify-start"
          >
            <MdLogout aria-hidden className="icon" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

/** Phone tab bar for logged-in people: Mural, Publicar and Painel. */
function TabBar({ pathname, onIntent }: { pathname: string; onIntent?: (href: string) => void }) {
  const tabs = [
    { href: "/", label: "Mural", icon: MdEvent },
    { href: "/eventos/novo", label: "Publicar", icon: MdAdd },
    { href: "/dashboard", label: "Painel", icon: MdDashboard },
  ];
  return (
    <nav
      aria-label="Atalhos"
      data-bottom-nav
      className="glass-strong fixed inset-x-4 bottom-4 z-40 grid h-[72px] grid-cols-3 items-center rounded-[26px] px-2 md:hidden"
    >
      {tabs.map((tab) => {
        const current = IsCurrent(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            {...IntentProps(tab.href, onIntent)}
            aria-current={current ? "page" : undefined}
            className={`column min-h-14 items-center justify-center gap-0.5 rounded-2xl text-[11px] focus-ring ${current ? "ink font-semibold" : "t2 font-medium"}`}
          >
            <tab.icon aria-hidden className="h-[22px] w-[22px]" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Branding on the left, session actions on the right, problems under the bar. */
export function Navbar({ auth, brand, brandError, pathname, logoutError, onLogout, onIntent }: NavbarProps) {
  const title = brand === null ? APP_NAME : brand.name;

  return (
    <>
      <header className="sticky top-0 z-40 w-full px-4 pt-4 sm:px-6 sm:pt-5 lg:px-8">
        <nav aria-label="Principal" className="glass between mx-auto max-w-page gap-3 rounded-[22px] py-2.5 pl-3.5 pr-2.5">
          <Link href="/" className="row min-h-11 min-w-0 gap-3 rounded-xl focus-ring">
            {brand !== null && brand.logo !== null ? (
              <span aria-hidden className="shrink-0">
                <ImageWithPlaceholder image={brand.logo} alt={`Logo de ${brand.name}`} className="h-9 w-9 rounded-[11px]" compact />
              </span>
            ) : (
              // The monogram is drawn by CSS (::before) so it stays out of the link's text.
              <span
                aria-hidden
                data-initial={Monogram(title)}
                className="logo-tile h-9 w-9 rounded-[11px] text-[13px] before:content-[attr(data-initial)]"
              />
            )}
            <span className="column min-w-0 leading-[1.15]">
              <span className="font-display truncate text-base font-bold tracking-tight">{APP_NAME}</span>
              {brand !== null && <span className="t3 truncate text-xs max-sm:sr-only">{brand.name}</span>}
            </span>
          </Link>

          <div className="row shrink-0 gap-2">
            {auth.status === "loading" && <span role="status" className="t3 text-sm">Carregando sessão...</span>}

            {auth.status === "anonymous" && (
              <>
                <ThemeIconButton />
                <Link href="/entrar" {...IntentProps("/entrar", onIntent)} className="button">Entrar</Link>
                <Link href="/cadastro" {...IntentProps("/cadastro", onIntent)} className="button main">Criar conta</Link>
              </>
            )}

            {auth.status === "authenticated" && (
              <>
                <Link
                  href="/dashboard"
                  {...IntentProps("/dashboard", onIntent)}
                  aria-current={IsCurrent("/dashboard", pathname) ? "page" : undefined}
                  className="button ghost max-md:hidden aria-[current=page]:bg-foreground/8"
                >
                  Painel
                </Link>
                <Link
                  href="/eventos/novo"
                  {...IntentProps("/eventos/novo", onIntent)}
                  aria-current={IsCurrent("/eventos/novo", pathname) ? "page" : undefined}
                  className="button main max-md:hidden"
                >
                  <MdAdd aria-hidden className="icon" />
                  Publicar
                </Link>
                <AccountMenu user={auth.user} onLogout={onLogout} />
              </>
            )}
          </div>
        </nav>

        {(auth.status === "error" || brandError !== null || logoutError !== null) && (
          <div className="column mx-auto max-w-page gap-2 pt-3">
            {auth.status === "error" && <ErrorAlert>{auth.message}</ErrorAlert>}
            {brandError !== null && <ErrorAlert>{brandError}</ErrorAlert>}
            {logoutError !== null && <ErrorAlert>{logoutError}</ErrorAlert>}
          </div>
        )}
      </header>

      {auth.status === "authenticated" && !TABLESS_PATHS.includes(pathname) && <TabBar pathname={pathname} onIntent={onIntent} />}
    </>
  );
}
