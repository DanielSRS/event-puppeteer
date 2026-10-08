/**
 * How the dashboard's "Meus Eventos" list describes each of the person's events.
 *
 * @module
 */

import type { Event } from "@/lib/api/schemas";

/** Where an own event stands. */
export type OwnEventStatus =
  /** Visible on the public pages and not over yet. */
  | "active"
  /** Hidden by moderation (manually or by reports). */
  | "hidden"
  /** Every day of the schedule is in the past. */
  | "past";

/** One row of "Meus Eventos". */
export type OwnEvent = {
  id: string;
  title: string;
  location: string;
  /** Days in date order. */
  days: Array<{ date: string; startTime?: string; endTime?: string }>;
  status: OwnEventStatus;
};

/**
 * Describes an event for the list. A hidden event is "hidden" even when it is
 * over: what the person needs to know first is that moderation removed it.
 *
 * @param today - Today as `YYYY-MM-DD` (in Brazil).
 */
export function ToOwnEvent(event: Event, today: string): OwnEvent {
  const days = [...event.schedule]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));

  const status: OwnEventStatus = event.isHidden
    ? "hidden"
    : days.every((day) => day.date < today) ? "past" : "active";

  return { id: event.id, title: event.title, location: event.location, days, status };
}
