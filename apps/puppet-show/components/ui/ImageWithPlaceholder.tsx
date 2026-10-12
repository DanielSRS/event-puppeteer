/**
 * An Image (event banner or organization logo) drawn over its Placeholder.
 *
 * The Placeholder is the blurred preview decoded from the Image's thumbhash: it
 * shows right away, keeps the layout steady while the picture loads, and is all
 * the viewer gets while the Image is not Approved (the API then sends no `url`).
 * The picture fades in over it once loaded. If it fails to load, the
 * Placeholder stays and a short notice says the picture is unavailable.
 *
 * @module
 */

"use client";

import { useState } from "react";
import { thumbHashToDataURL } from "thumbhash";
import type { ImageView } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";

/** The Placeholder of a base64 thumbhash as a data URL; an error for a malformed hash. */
export function PlaceholderDataUrl(thumbhash: string): Result<string, string> {
  try {
    const bytes = Uint8Array.from(atob(thumbhash), (char) => char.charCodeAt(0));
    return Ok(thumbHashToDataURL(bytes));
  } catch (cause) {
    return Err(cause instanceof Error ? cause.message : String(cause));
  }
}

/** Said when the picture fails to load. */
const UNAVAILABLE = "Imagem indisponível no momento.";

export type ImageWithPlaceholderProps = {
  image: ImageView;
  /** What the picture shows, for screen readers. */
  alt: string;
  /** Size and shape of the frame (e.g. `aspect-video w-full`); the picture covers it. */
  className?: string;
  /**
   * For frames too small for text (a logo in the bar): a failed load is then only told
   * through the accessible name.
   */
  compact?: boolean;
};

/**
 * The Image over its Placeholder, in a frame sized by `className`. Loading and failure are
 * kept per URL: a new picture starts over, hidden until it loads.
 */
export function ImageWithPlaceholder({ image, alt, className = "", compact = false }: ImageWithPlaceholderProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = image.url !== undefined && loadedUrl === image.url;
  const failed = image.url !== undefined && failedUrl === image.url;
  const placeholder = PlaceholderDataUrl(image.thumbhash);

  return (
    <div
      role={image.url === undefined || failed ? "img" : undefined}
      aria-label={image.url === undefined ? alt : failed ? `${alt}. ${UNAVAILABLE}` : undefined}
      className={`relative overflow-hidden bg-muted bg-cover bg-center ${className}`}
      style={placeholder.ok ? { backgroundImage: `url(${JSON.stringify(placeholder.value)})` } : undefined}
    >
      {image.url !== undefined && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Cloudinary URLs; next/image would re-host them
        <img
          src={image.url}
          alt={alt}
          onLoad={(event) => setLoadedUrl(event.currentTarget.getAttribute("src"))}
          onError={(event) => setFailedUrl(event.currentTarget.getAttribute("src"))}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {failed && !compact && (
        <p aria-hidden className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1 text-xs text-foreground">{UNAVAILABLE}</p>
      )}
    </div>
  );
}
