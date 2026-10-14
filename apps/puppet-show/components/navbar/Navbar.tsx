/**
 * The site's top bar: organization branding, navigation and the session.
 *
 * @module
 */

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MdAdd, MdClose, MdDashboard, MdEvent, MdLogin, MdLogout, MdMenu, MdPersonAdd, MdTv } from "react-icons/md";
import type { IconType } from "react-icons";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { AuthState } from "@/hooks/useAuth";
import type { ImageView } from "@/lib/api/schemas";

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

type NavItem = { href: string; label: string; icon: IconType; primary?: boolean };

/** Links for the current session state. */
function Items(auth: AuthState): NavItem[] {
  const common: NavItem[] = [
    { href: "/", label: "Mural", icon: MdEvent },
    { href: "/display", label: "Modo TV", icon: MdTv },
  ];
  if (auth.status === "authenticated") {
    return [
      ...common,
      { href: "/dashboard", label: "Painel", icon: MdDashboard },
      { href: "/eventos/novo", label: "Publicar", icon: MdAdd, primary: true },
    ];
  }
  if (auth.status === "anonymous") {
    return [
      ...common,
      { href: "/entrar", label: "Entrar", icon: MdLogin },
      { href: "/cadastro", label: "Criar conta", icon: MdPersonAdd, primary: true },
    ];
  }
  return common;
}

/** Whether `href` is the page being shown (sub-pages of the dashboard count). */
function IsCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Branding on the left; on wide screens the links inline with a greeting, on
 * phones a menu button (`aria-expanded`, Escape closes it and returns focus).
 */
export function Navbar({ auth, brand, brandError, pathname, logoutError, onLogout, onIntent }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items = Items(auth);
  const loggedIn = auth.status === "authenticated";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass = (item: NavItem) =>
    item.primary
      ? "button main touch"
      : "button touch border border-transparent hover:bg-foreground/8 aria-[current=page]:border-muted aria-[current=page]:bg-foreground/8 aria-[current=page]:text-foreground";

  const renderLinks = (onNavigate: () => void, stacked: boolean) => (
    <>
      {items.map((item) => (
        <li key={item.href} className={stacked ? "column" : ""}>
          <Link
            href={item.href}
            onClick={onNavigate}
            onMouseEnter={() => onIntent?.(item.href)}
            onFocus={() => onIntent?.(item.href)}
            onTouchStart={() => onIntent?.(item.href)}
            aria-current={IsCurrent(item.href, pathname) ? "page" : undefined}
            className={`${linkClass(item)} ${stacked ? "justify-start" : ""}`}
          >
            <item.icon aria-hidden className="icon" />
            {item.label}
          </Link>
        </li>
      ))}
      {loggedIn && (
        <li className={stacked ? "column" : ""}>
          <button type="button" onClick={() => { onNavigate(); onLogout(); }} className={`button touch hover:bg-foreground/8 ${stacked ? "justify-start" : ""}`}>
            <MdLogout aria-hidden className="icon" />
            Sair
          </button>
        </li>
      )}
    </>
  );

  const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-4">
      <nav aria-label="Principal" className="glass between gap-3 max-w-6xl mx-auto rounded-3xl pl-3 pr-2 h-16">
        <Link href="/" className="row gap-3 min-w-0 focus-ring rounded-2xl">
          {brand !== null && brand.logo !== null ? (
            <span aria-hidden className="shrink-0">
              <ImageWithPlaceholder image={brand.logo} alt={`Logo de ${brand.name}`} className="w-10 h-10 rounded-xl" compact />
            </span>
          ) : (
            // The initial is drawn by CSS (::before) so it stays out of the link's text.
            <span
              aria-hidden
              data-initial={(brand === null ? APP_NAME : brand.name).charAt(0)}
              className="center shrink-0 w-10 h-10 rounded-xl bg-accent text-on-accent font-display font-bold before:content-[attr(data-initial)]"
            />
          )}
          <span className="column min-w-0">
            <span className="font-display font-bold tracking-tight truncate">{brand === null ? APP_NAME : brand.name}</span>
            {brand !== null && <span className="text-xs text-foreground/75 truncate">{APP_NAME}</span>}
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-2">
          {loggedIn && <span className="text-sm text-foreground/75 mr-1">Olá, {auth.user.firstName}</span>}
          {auth.status === "loading" && <span role="status" className="text-sm text-foreground/75">Carregando sessão...</span>}
          <ul className="row gap-1">{renderLinks(() => undefined, false)}</ul>
          <ThemeToggle compact />
        </div>

        <button
          ref={buttonRef}
          type="button"
          className="button clean touch lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Fechar navegação" : "Abrir navegação"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <MdClose aria-hidden className="icon" /> : <MdMenu aria-hidden className="icon" />}
          <span aria-hidden>Navegação</span>
        </button>
      </nav>

      <div id={menuId} hidden={!open} onKeyDown={onMenuKeyDown} className="lg:hidden glass-strong max-w-6xl mx-auto mt-2 rounded-3xl p-3">
        {loggedIn && <p className="text-sm text-foreground/75 px-2 mb-2">Olá, {auth.user.firstName}</p>}
        {auth.status === "loading" && <p role="status" className="text-sm text-foreground/75 px-2 mb-2">Carregando sessão...</p>}
        <ul className="column gap-1">{renderLinks(() => setOpen(false), true)}</ul>
        <div className="between gap-3 mt-3 pt-3 border-t border-muted px-2">
          <span className="text-sm text-foreground/75">Tema</span>
          <ThemeToggle />
        </div>
      </div>

      {(auth.status === "error" || brandError !== null || logoutError !== null) && (
        <div className="max-w-6xl mx-auto pt-3 column gap-2">
          {auth.status === "error" && <ErrorAlert>{auth.message}</ErrorAlert>}
          {brandError !== null && <ErrorAlert>{brandError}</ErrorAlert>}
          {logoutError !== null && <ErrorAlert>{logoutError}</ErrorAlert>}
        </div>
      )}
    </header>
  );
}
