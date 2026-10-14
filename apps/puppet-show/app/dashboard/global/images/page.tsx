/**
 * Escalated Image Review page (Superadmin, global context).
 *
 * @module
 */

import type { Metadata } from "next";
import { GlobalImagesContainer } from "@/components/dashboard/global/images/GlobalImagesContainer";

export const metadata: Metadata = { title: "Imagens Escalonadas - Painel" };

/** The client container draws the header (with the "Sistema Global" badge) and the content. */
export default function Page() {
  return <GlobalImagesContainer />;
}
