/**
 * Frame of every dashboard page: navigation, a header naming the context
 * being managed, notices from the shell and the page itself.
 *
 * From the `md` breakpoint up the navigation is a sidebar; on phones it
 * collapses into a top bar whose "Seções" button opens it in a bottom sheet.
 *
 * @module
 */

"use client";

import { useState, type ReactNode } from "react";
import { MdMenu } from "react-icons/md";
import { Drawer } from "@/components/ui/Drawer";
import { DashboardSidebar, type DashboardSidebarProps } from "./DashboardSidebar";

/** Props of {@link DashboardLayout}. */
export type DashboardLayoutProps = Omit<DashboardSidebarProps, "onNavigate"> & {
  /** Messages from the shell (e.g. the context can't be remembered), shown above the page. */
  notices?: ReactNode;
  children: ReactNode;
};

/** Sidebar (or phone menu), context header and page content. */
export function DashboardLayout({ notices, children, ...sidebar }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex w-full max-w-[1400px] mx-auto min-w-0 flex-1 flex-col md:flex-row md:gap-2 md:px-4 md:pt-4">
      <aside aria-label="Navegação do painel" className="hidden w-68 shrink-0 md:block">
        <div className="glass sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-3xl p-3">
          <DashboardSidebar {...sidebar} />
        </div>
      </aside>

      <div className="glass sticky top-[5.25rem] z-30 mx-3 mt-3 between gap-3 rounded-2xl py-2 pl-4 pr-2 md:hidden">
        <p className="min-w-0 truncate text-sm">
          <span className="text-foreground/75">Painel · </span>
          <span className="font-semibold">{sidebar.contextName}</span>
        </p>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          className="button clean min-h-11 shrink-0"
        >
          <MdMenu aria-hidden className="icon" /> Seções
        </button>
      </div>

      <Drawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Menu do painel" placement="bottom">
        <DashboardSidebar {...sidebar} onNavigate={() => setMenuOpen(false)} />
      </Drawer>

      <main className="column min-w-0 flex-1 gap-4 p-4 sm:p-6 md:pt-2 lg:px-8">
        <p className="label-mono">
          Gerenciando: <strong className="text-main font-semibold">{sidebar.contextName}</strong>
        </p>
        {notices}
        <div className="column min-w-0 gap-6">{children}</div>
      </main>
    </div>
  );
}
