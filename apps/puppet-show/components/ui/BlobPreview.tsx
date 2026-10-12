/**
 * Shows a picture that only exists in the browser (a cropped Image not sent
 * yet), read as a data URL. A picture that can't be read is said so.
 *
 * @module
 */

"use client";

import { useEffect, useState } from "react";
import { ErrorAlert } from "./Feedback";

export type BlobPreviewProps = {
  picture: Blob;
  alt: string;
  className?: string;
};

/** What was read, kept with the picture it belongs to so a new picture starts over. */
type Read = { picture: Blob; url: string } | { picture: Blob; failed: true };

/** The picture, or a frame while it is read. */
export function BlobPreview({ picture, alt, className = "" }: BlobPreviewProps) {
  const [read, setRead] = useState<Read | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setRead(typeof reader.result === "string" ? { picture, url: reader.result } : { picture, failed: true });
    reader.onerror = () => setRead({ picture, failed: true });
    reader.readAsDataURL(picture);
    return () => { reader.onload = null; reader.onerror = null; reader.abort(); };
  }, [picture]);

  const current = read !== null && read.picture === picture ? read : null;
  if (current !== null && "failed" in current) return <ErrorAlert>Não foi possível mostrar a prévia da imagem escolhida.</ErrorAlert>;
  if (current === null) return <div role="img" aria-label={alt} className={`bg-muted ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image can't load it
  return <img src={current.url} alt={alt} className={className} />;
}
