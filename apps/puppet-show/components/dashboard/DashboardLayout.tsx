/**
 * Frame of every dashboard page: navigation, a header naming the context
 * being managed, notices from the shell and the page itself.
 *
 * From the `md` breakpoint up the navigation is a full-height glass sidebar
 * (brand, context, sections, theme and account). On phones it collapses into
 * a top bar whose "Seções" button opens the same navigation in a bottom sheet.
 * The site's top bar is hidden on dashboard pages: this frame replaces it.
 *
 * @module
 */

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MdLogout, MdMenu } from "react-icons/md";
import { Drawer } from "@/components/ui/Drawer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { APP_NAME } from "@/components/navbar/Navbar";
import { Monogram } from "@/utils/monogram";
import { DashboardSidebar, type DashboardSidebarProps } from "./DashboardSidebar";
import { AccessibleSections, SectionForPath } from "./DashboardSections";

/** The person using the dashboard, shown at the bottom of the navigation. */
export type DashboardAccount = { name: string; roleLabel: string };

/** Props of {@link DashboardLayout}. */
export type DashboardLayoutProps = Omit<DashboardSidebarProps, "onNavigate" | "variant"> & {
  /** Messages from the shell (e.g. the context can't be remembered), shown above the page. */
  notices?: ReactNode;
  /** Who is logged in; the account row is omitted without it. */
  account?: DashboardAccount;
  /** Logs out (the account row's "Sair"). */
  onLogout?: () => void;
  children: ReactNode;
};

/** Theme picker and, when known, the person with a logout button. */
function AccountPanel({ account, onLogout, wide }: { account?: DashboardAccount; onLogout?: () => void; wide: boolean }) {
  return (
    <div className="column gap-2.5 rounded-[18px] surface p-2.5">
      <ThemeToggle className="grid w-full grid-cols-3" />
      {account !== undefined && (
        <div className="row gap-2.5">
          <span aria-hidden className="avatar h-9 w-9">{Monogram(account.name, 2)}</span>
          <span className="column min-w-0 flex-1 leading-tight">
            <span className="truncate font-semibold">{account.name}</span>
            <span className="t3 text-xs">{account.roleLabel}</span>
          </span>
          {onLogout !== undefined && (wide ? (
            <button type="button" onClick={onLogout} aria-label="Sair" title="Sair" className="button ghost icon-only t2">
              <MdLogout aria-hidden className="icon" />
            </button>
          ) : (
            <button type="button" onClick={onLogout} className="button">Sair</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sidebar (or phone menu), context header and page content. */
export function DashboardLayout({ notices, account, onLogout, children, ...sidebar }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const brand = sidebar.orgId === null ? APP_NAME : sidebar.contextName;
  const active = SectionForPath(sidebar.pathname);
  const section = AccessibleSections({ role: sidebar.role }, sidebar.orgId).find((candidate) => candidate.id === active);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col md:flex-row md:gap-4 md:p-4">
      <aside aria-label="Navegação do painel" className="hidden w-[280px] shrink-0 md:block">
        <div className="glass sticky top-4 flex max-h-[calc(100dvh-2rem)] min-h-[calc(100dvh-2rem)] flex-col gap-[18px] overflow-y-auto rounded-[26px] p-3.5">
          <Link href="/" className="row min-h-11 gap-2.5 rounded-xl px-2 py-1.5 focus-ring">
            <span aria-hidden className="logo-tile h-[34px] w-[34px] rounded-[10px] text-xs">{Monogram(brand)}</span>
            <span className="font-display text-base font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <DashboardSidebar {...sidebar} />
          <div className="mt-auto">
            <AccountPanel account={account} onLogout={onLogout} wide />
          </div>
        </div>
      </aside>

      <header className="glass sticky top-0 z-30 row h-16 gap-3 !rounded-none !border-x-0 !border-t-0 !shadow-none pl-3.5 pr-2.5 md:hidden">
        <Link href="/" aria-label={APP_NAME} className="logo-tile h-9 w-9 rounded-[11px] text-xs focus-ring">{Monogram(brand)}</Link>
        <p className="column min-w-0 flex-1 leading-tight">
          <span className="truncate text-base font-bold">{section === undefined ? "Painel" : section.label}</span>
          <span className="t3 truncate text-xs">{sidebar.contextName}</span>
        </p>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-label="Seções"
          className="button ghost icon-only"
        >
          <MdMenu aria-hidden className="h-[22px] w-[22px]" />
        </button>
      </header>

      <Drawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Menu do painel" placement="bottom">
        <div className="column gap-4">
          <DashboardSidebar {...sidebar} variant="tiles" onNavigate={() => setMenuOpen(false)} />
          <AccountPanel account={account} onLogout={onLogout} wide={false} />
        </div>
      </Drawer>

      <main className="dash-main column min-w-0 flex-1 gap-[22px] px-4 pb-24 pt-[18px] md:px-3 md:pb-10 md:pt-4">
        <p className="caption">
          Gerenciando: <strong className="ink font-semibold">{sidebar.contextName}</strong>
        </p>
        {notices}
        <div className="column min-w-0 gap-[22px]">{children}</div>
      </main>
    </div>
  );
}
