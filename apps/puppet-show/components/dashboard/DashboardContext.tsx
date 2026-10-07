/* components/dashboard/DashboardContext.tsx */

"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/api/types";

export type DashboardSession = {
  user: User;
  /* THE ORGANIZATION BEING MANAGED; null WHEN A SUPERADMIN IS IN THE GLOBAL CONTEXT */
  orgId: string | null;
};

const DashboardContext = createContext<DashboardSession | null>(null);

export const DashboardProvider = DashboardContext.Provider;

export function useDashboard(): DashboardSession {
  const session = useContext(DashboardContext);

  if (!session)
    throw new Error("useDashboard must be used inside the dashboard layout");

  return session;
};

/* MOST ORG PAGES CAN'T WORK WITHOUT AN ORGANIZATION; THIS IS THE MESSAGE THEY SHOW */
export function SelectOrgNotice() {
  return (
    <div className="p-8 text-center text-foreground/60">
      Selecione uma organização no seletor do menu lateral para ver esta página.
    </div>
  );
};
