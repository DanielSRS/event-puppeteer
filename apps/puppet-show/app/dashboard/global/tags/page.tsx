/**
 * System tags page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalTagsContainer } from "@/components/dashboard/global/tags/GlobalTagsContainer";

export const metadata: Metadata = { title: "Tags Globais - Painel" };

/** The client container draws the header (with the "Sistema Global" badge) and the content. */
export default function Page() {
  return <GlobalTagsContainer />;
}
