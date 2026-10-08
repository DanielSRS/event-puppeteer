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
import type { AuthState } from "@/hooks/useAuth";

/** The product's name, shown for the Superadmin (who belongs to no organization) and next to an org name. */
export const APP_NAME = "Mural de Eventos";

/** Organization shown in the bar. */
export type NavBrand = { name: string; logo: string | null };

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
export function Navbar({ auth, brand, brandError, pathname, logoutError, onLogout }: NavbarProps) {
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
    `button touch ${item.primary ? "main" : "clean"} aria-[current=page]:border-main aria-[current=page]:text-main`;

  const renderLinks = (onNavigate: () => void, stacked: boolean) => (
    <>
      {items.map((item) => (
        <li key={item.href} className={stacked ? "column" : ""}>
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={IsCurrent(item.href, pathname) ? "page" : undefined}
            className={`${linkClass(item)} ${stacked ? "justify-start" : ""} ${item.primary && IsCurrent(item.href, pathname) ? "aria-[current=page]:text-background" : ""}`}
          >
            <item.icon aria-hidden className="icon" />
            {item.label}
          </Link>
        </li>
      ))}
      {loggedIn && (
        <li className={stacked ? "column" : ""}>
          <button type="button" onClick={() => { onNavigate(); onLogout(); }} className={`button clean touch ${stacked ? "justify-start" : ""}`}>
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
    <header className="sticky top-0 z-40 w-full border-b border-muted bg-background/95 backdrop-blur">
      <nav aria-label="Principal" className="between gap-3 max-w-6xl mx-auto px-4 h-16">
        <Link href="/" className="row gap-2 min-w-0 focus-ring rounded-lg">
          {brand !== null && brand.logo !== null && (
            <span aria-hidden className="w-9 h-9 shrink-0 rounded bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(brand.logo)})` }} />
          )}
          <span className="column min-w-0">
            <span className="font-semibold truncate">{brand === null ? APP_NAME : brand.name}</span>
            {brand !== null && <span className="text-xs text-foreground/80 truncate">{APP_NAME}</span>}
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-3">
          {loggedIn && <span className="text-sm text-foreground/80">Olá, {auth.user.firstName}</span>}
          {auth.status === "loading" && <span role="status" className="text-sm text-foreground/80">Carregando sessão...</span>}
          <ul className="row gap-2">{renderLinks(() => undefined, false)}</ul>
        </div>

        <button
          ref={buttonRef}
          type="button"
          className="button clean touch lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <MdClose aria-hidden className="icon" /> : <MdMenu aria-hidden className="icon" />}
          <span aria-hidden>Menu</span>
        </button>
      </nav>

      <div id={menuId} hidden={!open} onKeyDown={onMenuKeyDown} className="lg:hidden border-t border-muted bg-background px-4 py-3">
        {loggedIn && <p className="text-sm text-foreground/80 mb-2">Olá, {auth.user.firstName}</p>}
        {auth.status === "loading" && <p role="status" className="text-sm text-foreground/80 mb-2">Carregando sessão...</p>}
        <ul className="column gap-2">{renderLinks(() => setOpen(false), true)}</ul>
      </div>

      {(auth.status === "error" || brandError !== null || logoutError !== null) && (
        <div className="max-w-6xl mx-auto px-4 pb-3 column gap-2">
          {auth.status === "error" && <ErrorAlert>{auth.message}</ErrorAlert>}
          {brandError !== null && <ErrorAlert>{brandError}</ErrorAlert>}
          {logoutError !== null && <ErrorAlert>{logoutError}</ErrorAlert>}
        </div>
      )}
    </header>
  );
}
