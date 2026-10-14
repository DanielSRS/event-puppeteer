/**
 * Organizations page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalOrgsContainer } from "@/components/dashboard/global/orgs/GlobalOrgsContainer";

export const metadata: Metadata = { title: "Organizações - Painel" };

/** The client container draws the header (with its "Nova organização" action) and the list. */
export default function Page() {
  return <GlobalOrgsContainer />;
}
