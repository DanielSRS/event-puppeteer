/**
 * `/dashboard`: sends the person to the first section they can open.
 *
 * @module
 */

import { DashboardHome } from "@/components/dashboard/DashboardHome";

/** The dashboard entry point (the navbar's "Painel" link). */
export default function DashboardPage() {
  return <DashboardHome />;
}
