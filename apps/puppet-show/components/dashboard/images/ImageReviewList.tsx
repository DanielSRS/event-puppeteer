/**
 * Images awaiting Image Review, each with what is needed to judge it: whose
 * event or organization it belongs to, who sent it and when, the categories
 * Screening suspected (or that Screening could not run), and the picture.
 *
 * The picture starts hidden behind its blurred Placeholder: the reviewer
 * chooses to reveal each one, knowing beforehand what was suspected. Rejecting
 * is a Confirmed Rejection (the container confirms first, since it
 * shadow-bans the uploader).
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdCheck, MdImageSearch, MdBlock, MdVisibility, MdWarningAmber } from "react-icons/md";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { ImageReviewItem } from "@/lib/api/schemas";
import { FormatInstant } from "../audit/instant";
import { CATEGORY_LABELS, Percent, SuspectedCategories } from "./screeningLabels";

export type ImageReviewListProps = {
  items: ImageReviewItem[];
  /** Image whose decision is being sent. */
  busyId: string | null;
  onApprove: (item: ImageReviewItem) => void;
  /** Asks to reject (the container confirms first). */
  onReject: (item: ImageReviewItem) => void;
  /** Shows which organization each Image is from (the Superadmin's queue mixes them). */
  organizationNames?: ReadonlyMap<string, string>;
};

/** What the Image is, in words. */
export function ImageSubject(item: ImageReviewItem): string {
  return item.kind === "event_banner" ? `Banner do evento “${item.ownerName}”` : `Logo da organização ${item.ownerName}`;
}

/** The picture behind its Placeholder until the reviewer reveals it. */
function RevealablePicture({ item }: { item: ImageReviewItem }) {
  const [revealed, setRevealed] = useState(false);
  const subject = ImageSubject(item);
  const frame = item.kind === "event_banner" ? "aspect-video w-full" : "aspect-square w-40";

  return (
    <div className="column gap-2">
      <ImageWithPlaceholder
        image={revealed ? { url: item.previewUrl, thumbhash: item.thumbhash } : { thumbhash: item.thumbhash }}
        alt={revealed ? subject : `${subject} (oculta até ser revelada)`}
        className={`${frame} rounded-lg border border-muted`}
      />
      {!revealed && (
        <button type="button" onClick={() => setRevealed(true)} className="button clean self-start min-h-10">
          <MdVisibility aria-hidden className="icon" /> Revelar imagem<span className="sr-only"> {subject}</span>
        </button>
      )}
    </div>
  );
}

/** The queue, or an empty state. */
export function ImageReviewList({ items, busyId, onApprove, onReject, organizationNames }: ImageReviewListProps) {
  if (items.length === 0) {
    return (
      <div className="column items-center gap-2 rounded-lg border border-dashed border-muted p-8 text-center">
        <MdImageSearch aria-hidden className="w-12 h-12 text-foreground/50" />
        <h2 className="text-lg font-medium">Nenhuma imagem aguardando revisão</h2>
        <p className="text-sm text-foreground/70">Quando a análise automática tiver dúvida sobre uma imagem, ela aparece aqui.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="image-review-title" className="column gap-3">
      <h2 id="image-review-title" className="subtitle">Aguardando revisão ({items.length})</h2>
      <ul className="column gap-4">
        {items.map((item) => {
          const subject = ImageSubject(item);
          const suspected = SuspectedCategories(item.scores);
          const organization = organizationNames?.get(item.organizationId);
          const busy = busyId === item.id;
          return (
            <li key={item.id} className="card column gap-3">
              <div className="column gap-1">
                <h3 className="font-medium break-words">{subject}</h3>
                <p className="text-sm text-foreground/70">
                  Enviada por {item.uploaderName} em {FormatInstant(item.uploadedAt)}
                  {organization !== undefined && <> · {organization}</>}
                </p>
              </div>

              {item.notScreened && (
                <div className="row items-start gap-2 rounded-lg border border-main/40 bg-main/10 p-3 text-sm">
                  <MdWarningAmber aria-hidden className="icon shrink-0" />
                  <div className="column gap-1">
                    <p>Não analisada automaticamente: a análise falhou ou ainda não há política de triagem. Revise com atenção.</p>
                    {item.unscreenedReason !== undefined && <p className="text-foreground/80 break-words">Motivo técnico: {item.unscreenedReason}</p>}
                  </div>
                </div>
              )}
              {suspected.length === 0 ? (
                !item.notScreened && <p className="text-sm text-foreground/80">A análise automática não apontou nenhuma categoria.</p>
              ) : (
                <div className="column gap-1">
                  <p className="text-sm font-medium">Suspeitas da análise automática</p>
                  <ul className="flex flex-wrap gap-2" aria-label={`Suspeitas: ${subject}`}>
                    {suspected.map(({ category, score }) => (
                      <li key={category} className="rounded-full border border-muted px-3 py-1 text-sm">
                        {CATEGORY_LABELS[category]}: {Percent(score)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <RevealablePicture item={item} />

              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => onApprove(item)} className="button min-h-10">
                  <MdCheck aria-hidden className="icon" /> Aprovar<span className="sr-only"> {subject}</span>
                </button>
                <button type="button" disabled={busy} onClick={() => onReject(item)} className="button clean min-h-10 text-danger hover:border-danger">
                  <MdBlock aria-hidden className="icon" /> Rejeitar<span className="sr-only"> {subject}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
