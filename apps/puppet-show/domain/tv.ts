/**
 * What the TV display (kiosk) shows and for how long.
 *
 * The feed is shown in windows that rotate by themselves; the bento layout
 * features one event at a time (windows of 1). Each window stays on screen
 * {@link BASE_WINDOW_MS} plus {@link MS_PER_VOTE} for every vote its events
 * have, so popular events are seen for longer. With a single window nothing
 * rotates (no event is ever shown twice).
 *
 * Around the featured event the screen shows today's events, the agenda in
 * calendar order and a count of the next seven days (see the helpers below).
 *
 * @module
 */

import { DaysBetween, FeaturedDay, NextDay, ShortDate, type ScheduleDay } from "./schedule";

/** Events per window. */
export const TV_WINDOW_SIZE = 3;

/** Minimum time a window stays on screen. */
export const BASE_WINDOW_MS = 15_000;

/** Extra time per vote of the events in the window. */
export const MS_PER_VOTE = 1_000;

/** How often the display asks for a fresh feed. */
export const TV_REFRESH_MS = 30_000;

/** Splits the feed into consecutive windows of `size` events (the last may be shorter). */
export function TvWindows<T>(events: readonly T[], size: number = TV_WINDOW_SIZE): T[][] {
  const windows: T[][] = [];
  for (let start = 0; start < events.length; start += size) windows.push(events.slice(start, start + size));
  return windows;
}

/** How long a window stays on screen: `15 s + 1 s × votes in the window`. */
export function WindowDurationMs(window: ReadonlyArray<{ voteCount: number }>): number {
  const votes = window.reduce((sum, event) => sum + event.voteCount, 0);
  return BASE_WINDOW_MS + votes * MS_PER_VOTE;
}

/**
 * The window to show after `current`, wrapping around. A refresh may shrink
 * the feed, so an index past the end restarts at the first window.
 */
export function NextWindowIndex(current: number, windowCount: number): number {
  if (windowCount <= 1) return 0;
  return current + 1 >= windowCount ? 0 : current + 1;
}

/** `current` when it still exists after a refresh, otherwise the first window. */
export function ValidWindowIndex(current: number, windowCount: number): number {
  return current < windowCount ? current : 0;
}

/** What the summary helpers need from an event. */
export type TvAgendaEvent = { id: string; schedule: readonly ScheduleDay[]; voteCount: number; tags?: ReadonlyArray<{ id: string }> };

/** Sort key of an event: its featured day and start time (all-day events first). */
function AgendaKey(event: TvAgendaEvent, today: string): string {
  const day = FeaturedDay(event.schedule, today);
  return day === null ? "9999-99-99" : `${day.date} ${day.startTime ?? "00:00"}`;
}

/** The events in calendar order (by the day each one features), the input untouched. */
export function AgendaOrder<E extends TvAgendaEvent>(events: readonly E[], today: string): E[] {
  return [...events].sort((a, b) => AgendaKey(a, today).localeCompare(AgendaKey(b, today)));
}

/** Events with a day today, by start time. */
export function TodaysEvents<E extends TvAgendaEvent>(events: readonly E[], today: string): E[] {
  return AgendaOrder(events.filter((event) => event.schedule.some((day) => day.date === today)), today);
}

/** The first event whose next day comes after today, or `null`. */
export function NextAfterToday<E extends TvAgendaEvent>(events: readonly E[], today: string): E | null {
  const later = AgendaOrder(events.filter((event) => {
    const next = NextDay(event.schedule, today);
    return next !== null && next.date > today && !event.schedule.some((day) => day.date === today);
  }), today);
  return later.length === 0 ? null : later[0];
}

/** How many events have a day in the next seven days (today included), and in how many public tags. */
export function WeekSummary(events: readonly TvAgendaEvent[], today: string): { events: number; categories: number } {
  const inWeek = events.filter((event) => event.schedule.some((day) => {
    const offset = DaysBetween(today, day.date);
    return offset !== null && offset >= 0 && offset < 7;
  }));
  const tags = new Set(inWeek.flatMap((event) => (event.tags ?? []).map((tag) => tag.id)));
  return { events: inWeek.length, categories: tags.size };
}

/** The most liked event, when it has at least one like (the "Em alta" badge). */
export function HotEventId(events: readonly TvAgendaEvent[]): string | null {
  let best: TvAgendaEvent | null = null;
  for (const event of events) if (event.voteCount > 0 && (best === null || event.voteCount > best.voteCount)) best = event;
  return best === null ? null : best.id;
}

/** Short Portuguese weekdays, Sunday first. */
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** `"hoje"`, `"amanhã"` or `"sáb, 17 out"` for `iso` seen from `today`; the input itself when it isn't a date. */
export function RelativeDay(iso: string, today: string): string {
  const offset = DaysBetween(today, iso);
  if (offset === 0) return "hoje";
  if (offset === 1) return "amanhã";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${ShortDate(iso)}`;
}

/** How much more a soon event is worth: today/tomorrow ×3, this week ×2, later ×1. */
function ProximityFactor(event: TvAgendaEvent, today: string): number {
  const next = NextDay(event.schedule, today);
  const days = next === null ? null : DaysBetween(today, next.date);
  if (days === null) return 1;
  if (days <= 1) return 3;
  if (days <= 7) return 2;
  return 1;
}

/** An event's priority on the TV: its likes (plus one) times how soon it happens. */
export function TvPriority(event: TvAgendaEvent, today: string): number {
  return (event.voteCount + 1) * ProximityFactor(event, today);
}

/**
 * The order the featured event rotates in: one cycle where every event shows
 * at least once and higher-priority events show up to three times, spread
 * between the others (smooth weighted round-robin). So the screen keeps
 * coming back to what matters most instead of running through a long tail of
 * distant, unliked events, without ever showing the same event twice in a row
 * (when there are two or more), also where the cycle starts over.
 *
 * Shares in a cycle: 1, 2 or 3, scaled between the lowest and highest
 * {@link TvPriority}; equal priorities make a plain 1:1 rotation.
 */
export function RotationCycle<E extends TvAgendaEvent>(events: readonly E[], today: string): E[] {
  if (events.length <= 1) return [...events];
  const priorities = events.map((event) => TvPriority(event, today));
  const low = Math.min(...priorities);
  const high = Math.max(...priorities);
  const shares = priorities.map((p) => (high === low ? 1 : 1 + Math.round((2 * (p - low)) / (high - low))));
  const total = shares.reduce((sum, share) => sum + share, 0);

  const current = shares.map(() => 0);
  const cycle: E[] = [];
  let previous = -1;
  for (let step = 0; step < total; step++) {
    for (let i = 0; i < events.length; i++) current[i] += shares[i];
    let pick = -1;
    for (let i = 0; i < events.length; i++) {
      if (i === previous) continue;
      if (pick === -1 || current[i] > current[pick]) pick = i;
    }
    current[pick] -= total;
    cycle.push(events[pick]);
    previous = pick;
  }
  return NoRepeatAcrossLoop(cycle);
}

/** Whether no two neighbours are the same event, counting the last and the first (the cycle loops). */
function LoopsWithoutRepeat<E>(cycle: readonly E[]): boolean {
  return cycle.every((event, i) => event !== cycle[(i + 1) % cycle.length]);
}

/**
 * The cycle repeats, so its last item must differ from its first: when they
 * match, swap the last item with an earlier one that keeps every neighbour
 * different (left as is when no swap can).
 */
function NoRepeatAcrossLoop<E>(cycle: E[]): E[] {
  if (cycle.length < 2 || LoopsWithoutRepeat(cycle)) return cycle;
  const last = cycle.length - 1;
  for (let j = last - 1; j > 0; j--) {
    const candidate = [...cycle];
    [candidate[j], candidate[last]] = [candidate[last], candidate[j]];
    if (LoopsWithoutRepeat(candidate)) return candidate;
  }
  return cycle;
}
