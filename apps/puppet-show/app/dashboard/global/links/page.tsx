/**
 * Link labels page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalLinksContainer } from "@/components/dashboard/global/links/GlobalLinksContainer";

export const metadata: Metadata = { title: "Rótulos de Links - Painel" };

/** The client container draws the header (with the "Sistema Global" badge) and the content. */
export default function Page() {
  return <GlobalLinksContainer />;
}
