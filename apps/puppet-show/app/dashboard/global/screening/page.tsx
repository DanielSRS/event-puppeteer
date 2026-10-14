/**
 * Screening Policy page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalScreeningContainer } from "@/components/dashboard/global/screening/GlobalScreeningContainer";

export const metadata: Metadata = { title: "Política de Triagem - Painel" };

/** The client container draws the header (with the "Sistema Global" badge) and the content. */
export default function Page() {
  return <GlobalScreeningContainer />;
}
