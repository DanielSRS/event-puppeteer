/**
 * The person's own events in the managed organization ("Meus Eventos"),
 * including hidden and past ones: a glass panel with the count, a filter by
 * status and one row per event (date tile, title and place, days, status
 * badge, open and delete buttons). In a narrow content column the rows stack
 * into cards.
 *
 * Editing isn't offered: the spec blocks event editing (issue #1), so there is
 * no button for it. Vote counts aren't shown because `GET .../events/mine`
 * doesn't return them, and there is no banner thumbnail because the list
 * doesn't carry it; a date tile takes its place.
 *
 * @module
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { MdDeleteOutline, MdEvent, MdOpenInNew } from "react-icons/md";
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

/** Text and tone of each status badge. */
const BADGES: Record<OwnEventStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "b-ok" },
  hidden: { label: "Oculto pela moderação", className: "b-bad" },
  past: { label: "Encerrado", className: "b-neutral" },
};

/** The status filter above the list. */
type Filter = "all" | OwnEventStatus;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Próximos" },
  { id: "hidden", label: "Ocultos" },
  { id: "past", label: "Encerrados" },
];

/** Month abbreviations for the date tile. */
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Column widths shared by the header row and each event row. */
const COL_WHEN = "w-[240px] shrink-0 full-narrow";
const COL_STATUS = "w-[190px] shrink-0 full-narrow";
const COL_ACTIONS = "w-[100px] shrink-0 full-narrow";

/** One day of the schedule as text, e.g. "10/10/2026, 14:00–16:00". */
function DayLabel(day: OwnEvent["days"][number]): string {
  const date = FromISODate(day.date);
  if (day.startTime === undefined) return `${date}, dia todo`;
  if (day.endTime === undefined) return `${date}, a partir de ${day.startTime}`;
  return `${date}, ${day.startTime}–${day.endTime}`;
}

/** Day and month of the first day, for the tile at the start of the row. */
function DateTile({ event }: { event: OwnEvent }) {
  const first = event.days.at(0);
  const match = first === undefined ? null : /^\d{4}-(\d{2})-(\d{2})$/.exec(first.date);
  return (
    <span aria-hidden className="well grid h-12 w-[72px] shrink-0 place-items-center rounded-[10px] border border-[color:var(--line)] leading-none">
      {match === null ? <MdEvent className="h-5 w-5 t3" /> : (
        <span className="column items-center gap-0.5">
          <span className="font-display text-lg font-bold">{match[2]}</span>
          <span className="mono t3 text-[10px] tracking-[.06em]">{MONTHS[Number(match[1]) - 1] ?? ""}</span>
        </span>
      )}
    </span>
  );
}

/** "1 evento" / "N eventos". */
function CountLabel(count: number): string {
  return count === 1 ? "1 evento" : `${count} eventos`;
}

/** List of own events with loading, error and empty states. */
export function UserEventList({ state, onDelete, onRetry }: UserEventListProps) {
  const [filter, setFilter] = useState<Filter>("all");

  if (state.status === "loading") return <LoadingMessage>Carregando seus eventos...</LoadingMessage>;

  if (state.status === "error") {
    return (
      <div className="column gap-3">
        <ErrorAlert>{state.message}</ErrorAlert>
        <button type="button" onClick={onRetry} className="button self-start">Tentar de novo</button>
      </div>
    );
  }

  if (state.events.length === 0) {
    return (
      <div className="glass column items-center gap-3 rounded-[26px] px-6 py-10 text-center">
        <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] t2">
          <MdEvent className="h-6 w-6" />
        </span>
        <p className="t2 max-w-[44ch]">Você ainda não criou nenhum evento nesta organização.</p>
      </div>
    );
  }

  const shown = filter === "all" ? state.events : state.events.filter((event) => event.status === filter);

  return (
    <section aria-labelledby="own-events-count" className="glass overflow-hidden rounded-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3.5">
        <p id="own-events-count" className="text-[15px] font-semibold">{CountLabel(shown.length)}</p>
        <div role="group" aria-label="Filtrar por situação" className="segmented max-w-full overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((option) => (
            <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className="whitespace-nowrap text-[13px]">
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-hidden className="hide-narrow row gap-4 px-4 py-3 caption">
        <span className="min-w-0 flex-1">Evento</span>
        <span className={COL_WHEN}>Quando</span>
        <span className={COL_STATUS}>Situação</span>
        <span className={COL_ACTIONS} />
      </div>

      {shown.length === 0 ? (
        <p className="t2 border-t border-[color:var(--line)] px-4 py-8 text-center">Nenhum evento nesta situação.</p>
      ) : (
        <ul aria-label="Seus eventos">
          {shown.map((event) => {
            const badge = BADGES[event.status];
            return (
              <li key={event.id} className="stack-narrow row gap-4 border-t border-[color:var(--line)] px-4 py-3 transition-colors hover:bg-[var(--surface)]">
                <div className="row min-w-0 flex-1 gap-3.5">
                  <DateTile event={event} />
                  <div className="column min-w-0 gap-0.5">
                    <h2 id={`own-event-${event.id}`} className="min-w-0 break-words text-[15px] font-semibold leading-snug">{event.title}</h2>
                    <p className="t3 min-w-0 break-words text-[13px]">{event.location}</p>
                  </div>
                </div>

                <div className={`${COL_WHEN} row items-start gap-2`}>
                  <span className="cell-label">Quando</span>
                  <ul className="column mono t2 min-w-0 text-[13px]" aria-label="Dias">
                    {event.days.map((day) => <li key={day.date}>{DayLabel(day)}</li>)}
                  </ul>
                </div>

                <div className={COL_STATUS}>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                </div>

                <div className={`${COL_ACTIONS} flex justify-end gap-0.5`}>
                  <Link href={`/eventos/${event.id}`} className="button ghost icon-only t2 focus-ring">
                    <MdOpenInNew aria-hidden className="h-[18px] w-[18px]" />
                    <span className="sr-only">Ver página de {event.title}</span>
                  </Link>
                  <button type="button" onClick={() => onDelete(event)} className="button ghost icon-only t2 focus-ring hover:text-[color:var(--bad)]">
                    <MdDeleteOutline aria-hidden className="h-[18px] w-[18px]" />
                    <span className="sr-only">Excluir {event.title}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
