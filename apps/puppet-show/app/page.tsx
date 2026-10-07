/* app/page.tsx */

import QRCode from "qrcode";
import { HomeContent } from "@/components/home/HomeContent";

/* READS THE SITE ADDRESS ON EVERY REQUEST, SO THE QR CODE IS ALWAYS CURRENT */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  /* THE QR CODE IS GENERATED ON THE SERVER AND SENT AS SVG, SO NOTHING IS LOADED FROM OUTSIDE */
  const qrSvg = await QRCode.toString(siteUrl, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0b0b0f", light: "#ffffff" },
  });

  return <HomeContent qrSvg={qrSvg} />;
};
