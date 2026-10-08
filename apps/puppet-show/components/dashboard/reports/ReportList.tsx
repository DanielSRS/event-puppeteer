/**
 * The moderation queue: one card per reported event, with the number of
 * reports, their reasons and comments, the event's real visibility and the
 * button to hide or show it again.
 *
 * The API has no way to "resolve" or dismiss a report, so there is no such
 * button: a report stays in the queue for the record.
 *
 * @module
 */

import Link from "next/link";
import { MdOpenInNew, MdReport, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { ErrorAlert } from "@/components/ui/Feedback";
import { FormatInstant } from "../audit/instant";
import { REPORT_REASON_LABELS, ReportCountLabel, type ReportGroup } from "./reportGroups";

/** What the queue knows about a reported event. */
export type ReportedEvent =
  /** Loaded with `GET .../events/:id` (which also returns hidden events). */
  | { kind: "loaded"; title: string; isHidden: boolean; isDeleted: boolean }
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

/** Visibility badge of a loaded event. */
function VisibilityBadge({ event }: { event: Extract<ReportedEvent, { kind: "loaded" }> }) {
  if (event.isDeleted)
    return <span className="text-sm text-foreground/70">Excluído pelo autor</span>;
  if (event.isHidden)
    return (
      <span className="row gap-1 text-sm text-danger">
        <MdVisibilityOff aria-hidden className="w-4 h-4" /> Oculto do mural
      </span>
    );
  return (
    <span className="row gap-1 text-sm text-success">
      <MdVisibility aria-hidden className="w-4 h-4" /> Visível no mural
    </span>
  );
}

/** One reported event. */
function ReportCard({ item, busy, onSetHidden }: { item: ReportQueueItem; busy: boolean; onSetHidden: ReportListProps["onSetHidden"] }) {
  const { event } = item;
  const title = event.kind === "loaded" ? event.title : "Evento não carregado";

  return (
    <li className="card column gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="column gap-1 min-w-0">
          <h3 className="text-base font-semibold break-words">{title}</h3>
          <p className="text-xs text-foreground/70">
            {ReportCountLabel(item.count)} · primeira em {FormatInstant(item.firstReportedAt)}
            {item.count > 1 && <> · última em {FormatInstant(item.lastReportedAt)}</>}
          </p>
        </div>
        {event.kind === "loaded" && <VisibilityBadge event={event} />}
      </div>

      {event.kind === "error" && <ErrorAlert>{event.message}</ErrorAlert>}

      <ul className="flex flex-wrap gap-2" aria-label={`Motivos das denúncias de ${title}`}>
        {item.reasons.map(({ reason, count }) => (
          <li key={reason} className="rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger ring-1 ring-inset ring-danger/30">
            {REPORT_REASON_LABELS[reason]} ({count})
          </li>
        ))}
      </ul>

      {item.comments.length > 0 ? (
        <ul className="column gap-2" aria-label={`Comentários das denúncias de ${title}`}>
          {item.comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-background p-3 text-sm">
              <p className="break-words">“{comment.comment}”</p>
              <p className="mt-1 text-xs text-foreground/70">{FormatInstant(comment.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70">Nenhum comentário nas denúncias.</p>
      )}

      {event.kind === "loaded" && !event.isDeleted && (
        <div className="flex flex-col gap-2 border-t border-muted pt-3 sm:flex-row sm:justify-end">
          {!event.isHidden && (
            <Link
              href={`/eventos/${item.eventId}`}
              className="button clean min-h-10"
            >
              <MdOpenInNew aria-hidden className="icon" /> Ver evento<span className="sr-only"> {event.title}</span>
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onSetHidden(item.eventId, !event.isHidden)}
            className={`button min-h-10 ${event.isHidden ? "main" : "clean"}`}
          >
            {event.isHidden
              ? <><MdVisibility aria-hidden className="icon" /> {busy ? "Reexibindo..." : "Reexibir evento"}</>
              : <><MdVisibilityOff aria-hidden className="icon" /> {busy ? "Ocultando..." : "Ocultar evento"}</>}
            <span className="sr-only"> {event.title}</span>
          </button>
        </div>
      )}
    </li>
  );
}

/** The queue of reported events, or an empty state. */
export function ReportList({ items, busyEventId, onSetHidden }: ReportListProps) {
  if (items.length === 0) {
    return (
      <div className="column items-center gap-2 rounded-lg border border-dashed border-muted p-8 text-center">
        <MdReport aria-hidden className="w-12 h-12 text-foreground/50" />
        <h2 className="text-lg font-medium">Nenhuma denúncia</h2>
        <p className="text-sm text-foreground/70">Nenhum evento desta organização foi denunciado.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="report-queue-title" className="column gap-3">
      <h2 id="report-queue-title" className="subtitle">Eventos denunciados ({items.length})</h2>
      <ul className="column gap-4">
        {items.map((item) => (
          <ReportCard key={item.eventId} item={item} busy={busyEventId === item.eventId} onSetHidden={onSetHidden} />
        ))}
      </ul>
    </section>
  );
}
