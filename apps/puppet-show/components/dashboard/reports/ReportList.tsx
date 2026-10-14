/**
 * The moderation queue: one glass card per reported event, with its banner,
 * title and real visibility, how many reports it got and when, then two wells
 * side by side: the reasons (a proportional bar and a coloured legend) and the
 * reporters' comments. The buttons open the event or hide it / show it again.
 *
 * The API has no way to "resolve" or dismiss a report, so there is no such
 * button: a report stays in the queue for the record.
 *
 * @module
 */

import Link from "next/link";
import { MdCheck, MdPhotoLibrary, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { ImageView, ReportReason } from "@/lib/api/schemas";
import { FormatInstant } from "../audit/instant";
import { REPORT_REASON_LABELS, ReportCountLabel, type ReportGroup } from "./reportGroups";

/** What the queue knows about a reported event. */
export type ReportedEvent =
  /** Loaded with `GET .../events/:id` (which also returns hidden events); `banner` when it has one. */
  | { kind: "loaded"; title: string; isHidden: boolean; isDeleted: boolean; banner?: ImageView }
  /** The event couldn't be loaded; `message` says why. */
  | { kind: "error"; message: string };

/** One entry of the queue: the reports of an event plus the event itself. */
export type ReportQueueItem = ReportGroup & { event: ReportedEvent };

export type ReportListProps = {
  items: ReportQueueItem[];
  /** Event whose visibility is being changed right now; its button is disabled. */
  busyEventId: string | null;
  /** Hides (`hidden = true`) or shows again (`false`) an event. */
  onSetHidden: (eventId: string, hidden: boolean) => void;
};

/** Colour of each reason in the bar and the legend (same as the report form). */
const REASON_COLORS: Record<ReportReason, string> = {
  spam: "bg-[var(--bad)]",
  offensive_content: "bg-[var(--violet)]",
  incorrect_information: "bg-[var(--warn)]",
  duplicate: "bg-[var(--info)]",
};

/** Visibility badge of a loaded event. */
function VisibilityBadge({ event }: { event: Extract<ReportedEvent, { kind: "loaded" }> }) {
  if (event.isDeleted) return <span className="badge b-neutral">Excluído pelo autor</span>;
  if (event.isHidden) return <span className="badge b-bad">Oculto do mural</span>;
  return <span className="badge b-ok">Visível no mural</span>;
}

/** The event's banner, or a dashed frame when it has none (or couldn't be loaded). */
function Thumbnail({ event, title }: { event: ReportedEvent; title: string }) {
  if (event.kind === "loaded" && event.banner !== undefined)
    return <ImageWithPlaceholder image={event.banner} alt={`Banner de ${title}`} className="h-[76px] w-[120px] shrink-0 rounded-[14px]" />;
  return (
    <span aria-hidden className="surface t3 grid h-[76px] w-[120px] shrink-0 place-items-center rounded-[14px] border border-dashed border-[var(--line-2)]">
      <MdPhotoLibrary className="h-[22px] w-[22px]" />
    </span>
  );
}

/** When the reports arrived: one date for a single report, first and last otherwise. */
function ReportDates({ item }: { item: ReportQueueItem }) {
  if (item.count === 1) return <> · em {FormatInstant(item.firstReportedAt)}</>;
  return <> · primeira em {FormatInstant(item.firstReportedAt)} · última em {FormatInstant(item.lastReportedAt)}</>;
}

/** One reported event. */
function ReportCard({ item, busy, onSetHidden }: { item: ReportQueueItem; busy: boolean; onSetHidden: ReportListProps["onSetHidden"] }) {
  const { event } = item;
  const title = event.kind === "loaded" ? event.title : "Evento não carregado";

  return (
    <li className="glass column gap-4 rounded-[26px] p-5">
      <div className="flex flex-wrap items-start gap-4">
        <Thumbnail event={event} title={title} />

        <div className="column min-w-0 flex-[1_1_260px] gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="h2 text-[21px] break-words">{title}</h3>
            {event.kind === "loaded" && <VisibilityBadge event={event} />}
          </div>
          <p className="mono t3 text-[12.5px]">
            <strong className="font-sans text-sm font-semibold text-foreground">{ReportCountLabel(item.count)}</strong>
            <ReportDates item={item} />
          </p>
        </div>

        {event.kind === "loaded" && !event.isDeleted && (
          <div className="full-narrow flex flex-wrap gap-2 max-sm:w-full [&>*]:flex-1">
            {!event.isHidden && (
              <Link href={`/eventos/${item.eventId}`} className="button focus-ring">
                Ver evento<span className="sr-only"> {event.title}</span>
              </Link>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetHidden(item.eventId, !event.isHidden)}
              className={`button focus-ring ${event.isHidden ? "" : "danger-soft"}`}
            >
              {event.isHidden
                ? <><MdVisibility aria-hidden className="h-[17px] w-[17px]" /> {busy ? "Reexibindo..." : "Reexibir evento"}</>
                : <><MdVisibilityOff aria-hidden className="h-[17px] w-[17px]" /> {busy ? "Ocultando..." : "Ocultar evento"}</>}
              <span className="sr-only"> {event.title}</span>
            </button>
          </div>
        )}
      </div>

      {event.kind === "error" && <ErrorAlert>{event.message}</ErrorAlert>}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
        <div className="well column gap-3 rounded-[18px] p-4">
          <span className="caption">Motivos</span>
          <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {item.reasons.map(({ reason, count }) => (
              <span key={reason} className={REASON_COLORS[reason]} style={{ flexGrow: count }} />
            ))}
          </div>
          <ul className="column gap-1.5" aria-label={`Motivos das denúncias de ${title}`}>
            {item.reasons.map(({ reason, count }) => (
              <li key={reason} className="row gap-2.5">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-[2px] ${REASON_COLORS[reason]}`} />
                <span aria-hidden className="flex-1">{REPORT_REASON_LABELS[reason]}</span>
                <span aria-hidden className="mono">{count}</span>
                <span className="sr-only">{REPORT_REASON_LABELS[reason]} ({count})</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="well column gap-2.5 rounded-[18px] p-4">
          <span className="caption">{item.comments.length > 0 ? `Comentários · ${item.comments.length}` : "Comentários"}</span>
          {item.comments.length > 0 ? (
            <ul className="column gap-2.5" aria-label={`Comentários das denúncias de ${title}`}>
              {item.comments.map((comment) => (
                <li key={comment.id} className="column gap-0.5">
                  <p className="break-words">“{comment.comment}”</p>
                  <span className="t3 text-xs">{FormatInstant(comment.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t3">Nenhum comentário nas denúncias.</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** The queue of reported events, or an empty state. */
export function ReportList({ items, busyEventId, onSetHidden }: ReportListProps) {
  if (items.length === 0) {
    return (
      <div className="glass column items-center gap-2 rounded-[26px] px-6 py-14 text-center">
        <span aria-hidden className="c-ok grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--ok-bg)]">
          <MdCheck className="h-[26px] w-[26px]" />
        </span>
        <h2 className="h2 mt-2">Nenhuma denúncia</h2>
        <p className="t2">Nenhum evento desta organização foi denunciado.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="report-queue-title" className="column gap-3">
      <h2 id="report-queue-title" className="sr-only">Eventos denunciados ({items.length})</h2>
      <ul className="column gap-3.5">
        {items.map((item) => (
          <ReportCard key={item.eventId} item={item} busy={busyEventId === item.eventId} onSetHidden={onSetHidden} />
        ))}
      </ul>
    </section>
  );
}
