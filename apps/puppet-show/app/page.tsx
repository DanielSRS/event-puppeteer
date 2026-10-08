/**
 * Home page: the public feed of events.
 *
 * @module
 */

import { HomeContainer } from "@/components/home/containers/HomeContainer";
import { SiteQrCode } from "@/components/qrcode/siteQrCode";

/** Reads the site address on every request, so the QR code follows the configuration. */
export const dynamic = "force-dynamic";

/** Builds the QR code on the server and hands it to the live feed. */
export default async function HomePage() {
  return <HomeContainer qr={await SiteQrCode(process.env.NEXT_PUBLIC_SITE_URL)} />;
}
