/**
 * Sample Images for stories: real thumbhashes (so the Placeholder draws) and
 * small inline pictures standing in for Cloudinary URLs.
 *
 * @module
 */

import type { ImageView } from "@/lib/api/schemas";

/** Thumbhash of a 16:9 amber-to-pink gradient. */
export const BANNER_THUMBHASH = "J/oKVJCCd4dwh3d3iHeFf/iHeA==";

/** Thumbhash of a square blue gradient. */
export const LOGO_THUMBHASH = "lYYJZwBwh3eHiIiHiIiIeIiI94iI8I4H";

/** An inline 16:9 picture. */
export const BANNER_URL = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'><rect width='16' height='9' fill='%23f59e0b'/></svg>";

/** An inline square picture. */
export const LOGO_URL = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='8' height='8' fill='%232563eb'/></svg>";

/** A banner the viewer may see. */
export const APPROVED_BANNER: ImageView = { url: BANNER_URL, thumbhash: BANNER_THUMBHASH };

/** A banner the viewer may only see the Placeholder of. */
export const PENDING_BANNER: ImageView = { thumbhash: BANNER_THUMBHASH };

/**
 * A real picture file drawn in the browser (stories only): a gradient of
 * `width`×`height` pixels, as a person would pick from their device.
 */
export async function PictureFile(width: number, height: number, type: "image/png" | "image/jpeg" = "image/png"): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (context !== null) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#f59e0b");
    gradient.addColorStop(1, "#db2777");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  const blob = await canvas.convertToBlob({ type });
  return new File([blob], type === "image/png" ? "foto.png" : "foto.jpg", { type });
}
