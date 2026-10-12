/**
 * The organization's logo on the settings page: the current one (as the
 * viewer may see it), a cropper to upload a new square logo and a button to
 * remove it.
 *
 * A new logo goes through an automatic analysis before everyone sees it; its
 * uploader always sees it as published, so nothing here says whether it was
 * accepted.
 *
 * @module
 */

"use client";

import { MdDeleteOutline } from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { ImageView } from "@/lib/api/schemas";
import { LOGO_RULES } from "@/utils/crop";

export type LogoPanelProps = {
  /** Name of the organization, for the logo's description. */
  orgName: string;
  /** The current logo; `null` when the organization never had one. */
  logo: ImageView | null;
  /** While an upload or removal is being sent. */
  busy: boolean;
  /** Confirmation of the last change. */
  notice: string;
  /** Why the last change failed. */
  error: string;
  onUpload: (picture: Blob) => void;
  onRemove: () => void;
};

/** Current logo and how to change it. */
export function LogoPanel({ orgName, logo, busy, notice, error, onUpload, onRemove }: LogoPanelProps) {
  return (
    <section aria-labelledby="logo-panel-title" className="card column gap-4">
      <h2 id="logo-panel-title" className="subtitle">Logo</h2>
      {logo === null ? (
        <p className="text-sm text-foreground/80">A organização ainda não tem logo.</p>
      ) : (
        <div className="row gap-4">
          <ImageWithPlaceholder image={logo} alt={`Logo de ${orgName}`} className="h-24 w-24 shrink-0 rounded-lg border border-muted" />
          <button type="button" disabled={busy} onClick={onRemove} className="button clean min-h-10 text-danger hover:border-danger">
            <MdDeleteOutline aria-hidden className="icon" />
            Remover logo
          </button>
        </div>
      )}
      <StatusMessage>{notice}</StatusMessage>
      <ErrorAlert>{error}</ErrorAlert>
      <ImageCropper rules={LOGO_RULES} purpose="logo da organização" disabled={busy} onCropped={onUpload} />
    </section>
  );
}
