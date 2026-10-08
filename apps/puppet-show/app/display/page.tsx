/**
 * TV display (kiosk mode): `/display`. Meant for screens in public spaces;
 * the site's navigation bar is not shown here.
 *
 * @module
 */

import type { Metadata } from "next";
import { SiteQrCode } from "@/components/qrcode/siteQrCode";
import { TvDisplayContainer } from "@/components/tv/TvDisplayContainer";

export const metadata: Metadata = {
  title: "Modo TV | Mural de Eventos",
};

/** Reads the site address on every request, so the QR code follows the configuration. */
export const dynamic = "force-dynamic";

/** Builds the QR code on the server and hands it to the live display. */
export default async function TvDisplayPage() {
  return <TvDisplayContainer qr={await SiteQrCode(process.env.NEXT_PUBLIC_SITE_URL)} />;
}
