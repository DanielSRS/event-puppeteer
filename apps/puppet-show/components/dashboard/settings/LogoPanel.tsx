/**
 * The organization's logo on the settings page, as a glass card: the current
 * logo (as the viewer may see it) or the organization's monogram, where the
 * logo appears, a dashed area with the cropper to upload a new square logo,
 * and a button to remove it.
 *
 * A new logo goes through an automatic analysis before everyone sees it; its
 * uploader always sees it as published, so nothing here says whether it was
 * accepted.
 *
 * @module
 */

"use client";

import { MdDeleteOutline, MdImageSearch } from "react-icons/md";
import { ErrorAlert, StatusMessage } from "@/components/ui/Feedback";
import { ImageCropper } from "@/components/ui/ImageCropper";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { ImageView } from "@/lib/api/schemas";
import { LOGO_RULES } from "@/utils/crop";
import { Monogram } from "@/utils/monogram";

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
  /** Extra classes for the card (its size in the page layout). */
  className?: string;
};

/** Current logo and how to change it. */
export function LogoPanel({ orgName, logo, busy, notice, error, onUpload, onRemove, className = "" }: LogoPanelProps) {
  return (
    <section aria-labelledby="logo-panel-title" className={`glass column min-w-0 gap-4 rounded-[24px] p-[22px] ${className}`}>
      <h2 id="logo-panel-title" className="h2 text-[19px]">Logo</h2>
      <div className="row gap-4">
        {logo === null ? (
          <span aria-hidden className="logo-tile h-24 w-24 rounded-[26px] text-[26px]">{Monogram(orgName)}</span>
        ) : (
          <ImageWithPlaceholder image={logo} alt={`Logo de ${orgName}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-[26px] border border-[color:var(--line-2)]" />
        )}
        <div className="column min-w-0 gap-1">
          {logo === null && <p className="font-semibold">A organização ainda não tem logo.</p>}
          <p className="t2 text-sm">Aparece na barra do mural, no menu do Painel e no Modo TV.</p>
        </div>
      </div>

      <StatusMessage>{notice}</StatusMessage>
      <ErrorAlert>{error}</ErrorAlert>

      <div className="well column gap-3 rounded-[18px] border-[1.5px] border-dashed border-[color:var(--line-2)] p-4">
        <p className="row gap-2 font-semibold">
          <MdImageSearch aria-hidden className="h-5 w-5 shrink-0 t2" /> Escolher nova imagem
        </p>
        <p className="t3 -mt-2 text-[12.5px]">Você recorta em quadrado antes de enviar.</p>
        <ImageCropper rules={LOGO_RULES} purpose="logo da organização" disabled={busy} onCropped={onUpload} />
      </div>

      {logo !== null && (
        <button type="button" disabled={busy} onClick={onRemove} className="button danger-soft self-start">
          <MdDeleteOutline aria-hidden className="h-[18px] w-[18px]" />
          Remover logo
        </button>
      )}
    </section>
  );
}
