/**
 * Layout of every `/dashboard/*` page: the shell checks the session, the
 * context and the access rules before a page renders.
 *
 * @module
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";

export const metadata: Metadata = {
  title: "Painel",
};

/** Wraps the dashboard pages in the shell. */
export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  return <DashboardContainer>{children}</DashboardContainer>;
}
