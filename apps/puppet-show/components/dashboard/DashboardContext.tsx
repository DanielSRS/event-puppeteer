/**
 * The dashboard session shared by every dashboard page: who is logged in and
 * which organization they are managing.
 *
 * Pages read it with {@link useDashboard}. The shell (`DashboardContainer`)
 * already guards every `/dashboard/*` route with {@link CanAccess}, so a page
 * only renders for people allowed to see it in the current context; pages that
 * show controls for a subset of roles should use the same function.
 *
 * @module
 */

"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/api/schemas";

export {
  AccessibleSections, CanAccess, SectionDenialFor, SectionForPath, SectionInfo,
  type DashboardSection, type DashboardSectionInfo, type SectionDenial,
} from "./DashboardSections";

/** What every dashboard page knows about the session. */
export type DashboardSession = {
  /** The logged-in user. */
  user: User;
  /** The organization being managed; `null` when a Superadmin is in the global context. */
  orgId: string | null;
};

const DashboardContext = createContext<DashboardSession | null>(null);

/** Provides the {@link DashboardSession}; only the dashboard shell renders it. */
export const DashboardProvider = DashboardContext.Provider;

/**
 * The current dashboard session. Only valid inside the dashboard layout; using
 * it elsewhere is a programming error and fails loudly.
 */
export function useDashboard(): DashboardSession {
  const session = useContext(DashboardContext);

  if (!session)
    throw new Error("useDashboard must be used inside the dashboard layout");

  return session;
}

/** Shown by organization pages when a Superadmin is in the global context. */
export function SelectOrgNotice() {
  return (
    <p className="card text-center text-foreground/80">
      Selecione uma organização no seletor de contexto para ver esta página.
    </p>
  );
}
