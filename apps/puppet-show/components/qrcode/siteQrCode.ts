/**
 * The QR code that takes people from a big screen to the site on their phone.
 *
 * Generated on the server with the `qrcode` package as an SVG string, so the
 * page loads nothing from outside. The address comes from
 * `NEXT_PUBLIC_SITE_URL`; there is no default, a missing or invalid value is
 * reported so the screen can say what to configure.
 *
 * @module
 */

import QRCode from "qrcode";
import { Err, Ok, type Result } from "@/lib/result";

/** A ready QR code, or the reason (for the person) it couldn't be made. */
export type SiteQr = Result<{ url: string; svg: string }, string>;

/** Shown when `NEXT_PUBLIC_SITE_URL` is not set. */
export const MISSING_SITE_URL_MESSAGE =
  "Endereço do site não configurado: defina NEXT_PUBLIC_SITE_URL para exibir o QR Code.";

/**
 * Builds the QR code for `url`; pages pass `process.env.NEXT_PUBLIC_SITE_URL`
 * on every request, so it follows the configuration.
 */
export async function SiteQrCode(url: string | undefined): Promise<SiteQr> {
  if (url === undefined || url.trim() === "") return Err(MISSING_SITE_URL_MESSAGE);
  if (!URL.canParse(url)) return Err(`NEXT_PUBLIC_SITE_URL não é um endereço válido: "${url}".`);

  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0b0f", light: "#ffffff" },
    });
    return Ok({ url, svg });
  } catch (cause) {
    return Err(`Não foi possível gerar o QR Code: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}
