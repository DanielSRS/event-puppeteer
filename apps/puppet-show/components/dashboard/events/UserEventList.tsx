/**
 * The person's own events in the managed organization ("Meus Eventos"),
 * including hidden and past ones, as cards that stack on phones.
 *
 * Editing isn't offered: the spec blocks event editing (issue #1), so there is
 * no button for it. Vote counts aren't shown because `GET .../events/mine`
 * doesn't return them.
 *
 * @module
 */

import Link from "next/link";
import { MdDelete, MdOpenInNew, MdPlace, MdSchedule } from "react-icons/md";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { FromISODate } from "@/utils/date";
import type { OwnEvent, OwnEventStatus } from "./OwnEvents";

/** What the list has to show. */
export type UserEventListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; events: OwnEvent[] };

/** Props of {@link UserEventList}. */
export type UserEventListProps = {
  state: UserEventListState;
  /** Asks to delete an event (the caller confirms first). */
  onDelete: (event: OwnEvent) => void;
  /** Loads the list again after an error. */
  onRetry: () => void;
};

/** Text and colours of each status badge. */
const BADGES: Record<OwnEventStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "border-success/40 bg-success/10 text-success" },
  hidden: { label: "Oculto pela moderação", className: "border-danger/40 bg-danger/10 text-danger" },
  past: { label: "Encerrado", className: "border-muted bg-white/5 text-foreground/80" },
};

/** One day of the schedule as text, e.g. "10/10/2026, 14:00–16:00". */
function DayLabel(day: OwnEvent["days"][number]): string {
  const date = FromISODate(day.date);
  if (day.startTime === undefined) return `${date}, dia todo`;
  if (day.endTime === undefined) return `${date}, a partir de ${day.startTime}`;
  return `${date}, ${day.startTime}–${day.endTime}`;
}

/** List of own events with loading, error and empty states. */
export function UserEventList({ state, onDelete, onRetry }: UserEventListProps) {
  if (state.status === "loading") return <LoadingMessage>Carregando seus eventos...</LoadingMessage>;

  if (state.status === "error") {
    return (
      <div className="column gap-3">
        <ErrorAlert>{state.message}</ErrorAlert>
        <button type="button" onClick={onRetry} className="button clean min-h-10 self-start">Tentar de novo</button>
      </div>
    );
  }

  if (state.events.length === 0)
    return <p className="card text-center text-foreground/80">Você ainda não criou nenhum evento nesta organização.</p>;

  return (
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Seus eventos">
      {state.events.map((event) => {
        const badge = BADGES[event.status];
        return (
          <li key={event.id}>
            <article className="card column h-full gap-3" aria-labelledby={`own-event-${event.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 id={`own-event-${event.id}`} className="min-w-0 break-words text-base font-semibold">{event.title}</h2>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              <div className="column gap-1 text-sm text-foreground/80">
                <p className="row items-start gap-2">
                  <MdPlace aria-hidden className="icon shrink-0" />
                  <span className="min-w-0 break-words">{event.location}</span>
                </p>
                <div className="row items-start gap-2">
                  <MdSchedule aria-hidden className="icon shrink-0" />
                  <ul className="column min-w-0" aria-label="Dias">
                    {event.days.map((day) => <li key={day.date}>{DayLabel(day)}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2 border-t border-muted pt-3 sm:flex-row">
                <Link href={`/eventos/${event.id}`} className="button clean min-h-10">
                  <MdOpenInNew aria-hidden className="icon" /> Ver página<span className="sr-only"> de {event.title}</span>
                </Link>
                <button type="button" onClick={() => onDelete(event)} className="button clean min-h-10 text-danger">
                  <MdDelete aria-hidden className="icon" /> Excluir<span className="sr-only"> {event.title}</span>
                </button>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
