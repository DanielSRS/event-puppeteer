/**
 * Images awaiting Image Review, as a grid of glass cards, each with what is
 * needed to judge it: the picture (hidden behind its blurred Placeholder, with
 * a "Revelar imagem" button over it), whose event or organization it belongs
 * to, who sent it and when, a warning when Screening could not run, and the
 * categories Screening suspected as bars in a well. Rejeitar and Aprovar sit
 * side by side at the bottom.
 *
 * The reviewer chooses to reveal each picture, knowing beforehand what was
 * suspected. Rejecting is a Confirmed Rejection (the container confirms first,
 * since it shadow-bans the uploader).
 *
 * @module
 */

"use client";

import { useState } from "react";
import { MdCheck, MdVisibility, MdWarningAmber } from "react-icons/md";
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

/** Colours of the suspicion bars, in order of suspicion. */
const BAR_COLORS = ["bg-[var(--bad)]", "bg-[var(--warn)]", "bg-[var(--violet)]"] as const;

/** What the Image is, in words. */
export function ImageSubject(item: ImageReviewItem): string {
  return item.kind === "event_banner" ? `Banner do evento “${item.ownerName}”` : `Logo da organização ${item.ownerName}`;
}

/** The picture behind its Placeholder until the reviewer reveals it. */
function RevealablePicture({ item }: { item: ImageReviewItem }) {
  const [revealed, setRevealed] = useState(false);
  const subject = ImageSubject(item);
  const frame = item.kind === "event_banner" ? "aspect-video w-full" : "aspect-square w-[220px] max-w-full";

  return (
    <div className={`relative ${item.kind === "event_banner" ? "w-full" : "max-w-full self-center"}`}>
      <ImageWithPlaceholder
        image={revealed ? { url: item.previewUrl, thumbhash: item.thumbhash } : { thumbhash: item.thumbhash }}
        alt={revealed ? subject : `${subject} (oculta até ser revelada)`}
        className={`${frame} rounded-[18px]`}
      />
      {!revealed && (
        <div className="absolute inset-0 grid place-items-center p-3">
          <button type="button" onClick={() => setRevealed(true)} className="button glass-photo focus-ring rounded-full px-[18px] font-semibold">
            <MdVisibility aria-hidden className="h-[17px] w-[17px]" /> Revelar imagem<span className="sr-only"> {subject}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** The queue, or an empty state. */
export function ImageReviewList({ items, busyId, onApprove, onReject, organizationNames }: ImageReviewListProps) {
  if (items.length === 0) {
    return (
      <div className="glass column items-center gap-2 rounded-[26px] px-6 py-14 text-center">
        <span aria-hidden className="c-ok grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--ok-bg)]">
          <MdCheck className="h-[26px] w-[26px]" />
        </span>
        <h2 className="h2 mt-2">Nenhuma imagem aguardando revisão</h2>
        <p className="t2">Quando a análise automática tiver dúvida sobre uma imagem, ela aparece aqui.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="image-review-title" className="column gap-3">
      <h2 id="image-review-title" className="sr-only">Aguardando revisão ({items.length})</h2>
      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(440px,100%),1fr))]">
        {items.map((item) => {
          const subject = ImageSubject(item);
          const suspected = SuspectedCategories(item.scores);
          const organization = organizationNames?.get(item.organizationId);
          const busy = busyId === item.id;
          return (
            <li key={item.id} className="glass column gap-4 rounded-[26px] p-4">
              <RevealablePicture item={item} />

              <div className="column gap-1">
                <h3 className="h2 text-[19px] break-words">{subject}</h3>
                <p className="t3 text-[13px]">
                  Enviada por {item.uploaderName} em {FormatInstant(item.uploadedAt)}
                  {organization !== undefined && <> · {organization}</>}
                </p>
              </div>

              {item.notScreened && (
                <div className="notice n-warn">
                  <MdWarningAmber aria-hidden className="mt-px h-[18px] w-[18px] shrink-0" />
                  <div className="column min-w-0 gap-1">
                    <p>Não analisada automaticamente: a análise falhou ou ainda não há política de triagem. Revise com atenção.</p>
                    {item.unscreenedReason !== undefined && <p className="mono text-xs break-words">Motivo técnico: {item.unscreenedReason}</p>}
                  </div>
                </div>
              )}
              {suspected.length === 0 ? (
                !item.notScreened && <p className="t3 text-sm">A análise automática não apontou nenhuma categoria.</p>
              ) : (
                <div className="well column gap-2.5 rounded-2xl p-3.5">
                  <p className="caption">Suspeitas da análise automática</p>
                  <ul className="column gap-2.5" aria-label={`Suspeitas: ${subject}`}>
                    {suspected.map(({ category, score }, index) => (
                      <li key={category} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
                        <span>{CATEGORY_LABELS[category]}<span className="sr-only">: </span></span>
                        <span className="mono font-semibold">{Percent(score)}</span>
                        <span aria-hidden className="surface-2 col-span-full h-1.5 overflow-hidden rounded-full">
                          <span className={`block h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`} style={{ width: Percent(score) }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-auto grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => onReject(item)} className="button danger-soft focus-ring min-h-12">
                  Rejeitar<span className="sr-only"> {subject}</span>
                </button>
                <button type="button" disabled={busy} onClick={() => onApprove(item)} className="button main focus-ring min-h-12">
                  Aprovar<span className="sr-only"> {subject}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
