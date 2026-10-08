/**
 * Frame of every dashboard page: navigation, a header naming the context
 * being managed, notices from the shell and the page itself.
 *
 * From the `md` breakpoint up the navigation is a sidebar; on phones it
 * collapses into a top bar whose "Menu" button opens it in a panel.
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
    <div className="flex w-full min-w-0 flex-1 flex-col md:flex-row">
      <aside aria-label="Navegação do painel" className="hidden w-64 shrink-0 border-r border-muted p-4 md:block">
        <div className="sticky top-4">
          <DashboardSidebar {...sidebar} />
        </div>
      </aside>

      <div className="between gap-3 border-b border-muted px-4 py-2 md:hidden">
        <p className="min-w-0 truncate text-sm">
          <span className="text-foreground/80">Painel · </span>
          <span className="font-semibold">{sidebar.contextName}</span>
        </p>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          className="button clean min-h-10 shrink-0"
        >
          <MdMenu aria-hidden className="icon" /> Menu
        </button>
      </div>

      <Drawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Menu do painel">
        <DashboardSidebar {...sidebar} onNavigate={() => setMenuOpen(false)} />
      </Drawer>

      <main className="column min-w-0 flex-1 gap-4 p-4 sm:p-6 lg:p-8">
        <p className="text-sm text-foreground/80">
          Gerenciando: <strong className="text-foreground">{sidebar.contextName}</strong>
        </p>
        {notices}
        <div className="column min-w-0 gap-6">{children}</div>
      </main>
    </div>
  );
}
