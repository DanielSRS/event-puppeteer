/**
 * How an event's schedule is told to people: date badges, time ranges and the
 * "lasts several days" hint shown on cards, the TV display and the details page.
 *
 * A schedule is a list of days (`YYYY-MM-DD`). Each day either has no times
 * (all day), only a start time, or a start and an end time. Dates are calendar
 * dates without a time zone, so they are formatted in UTC to never shift a day.
 *
 * @module
 */

/** One day of a schedule, as the API sends it (extra fields are ignored). */
export type ScheduleDay = {
  date: string;
  startTime?: string;
  endTime?: string;
};

/** Short Portuguese month names, January first. */
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** Splits `YYYY-MM-DD` into numbers, or `null` when it isn't such a date. */
function DateParts(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** The schedule's days in calendar order (the input is left untouched). */
export function SortedDays<D extends ScheduleDay>(schedule: readonly D[]): D[] {
  return [...schedule].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Day and short month for a calendar badge: `"2026-10-15"` → `{ day: "15", month: "out" }`.
 * `null` when `iso` isn't a `YYYY-MM-DD` date.
 */
export function DateBadge(iso: string): { day: string; month: string } | null {
  const parts = DateParts(iso);
  if (parts === null || parts.month < 1 || parts.month > 12) return null;
  return { day: String(parts.day).padStart(2, "0"), month: MONTHS[parts.month - 1] };
}

/** `"2026-10-15"` → `"15 out"`; the input itself when it isn't a date. */
export function ShortDate(iso: string): string {
  const badge = DateBadge(iso);
  return badge === null ? iso : `${badge.day} ${badge.month}`;
}

/** `"2026-10-15"` → `"quinta-feira, 15 de outubro de 2026"`; the input itself when it isn't a date. */
export function FullDate(iso: string): string {
  const parts = DateParts(iso);
  if (parts === null) return iso;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * When a day happens, in words: `"14:00 – 16:00"`, `"A partir das 14:00"` (start
 * only) or `"Dia todo"` (no times).
 */
export function TimeRange(day: ScheduleDay): string {
  if (day.startTime === undefined) return "Dia todo";
  if (day.endTime === undefined) return `A partir das ${day.startTime}`;
  return `${day.startTime} – ${day.endTime}`;
}

/**
 * How long an event spans, for cards: `null` for a single day, `"3 dias"` when
 * the days are consecutive, otherwise the first and last day (`"15 out – 20 out"`).
 */
export function MultiDayLabel(schedule: readonly ScheduleDay[]): string | null {
  const days = SortedDays(schedule);
  if (days.length < 2) return null;

  const first = days[0].date;
  const last = days[days.length - 1].date;
  const span = DaysBetween(first, last);
  if (span !== null && span === days.length - 1) return `${days.length} dias`;
  return `${ShortDate(first)} – ${ShortDate(last)}`;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), or `null` when either isn't a date. */
export function DaysBetween(from: string, to: string): number | null {
  const a = DateParts(from);
  const b = DateParts(to);
  if (a === null || b === null) return null;
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}

/**
 * The day a card should feature: the first day on or after `today`, or `null`
 * when every day is already past (or the schedule is empty).
 *
 * @param today - `YYYY-MM-DD`, see `TodayInBrazil` in `utils/date`.
 */
export function NextDay<D extends ScheduleDay>(schedule: readonly D[], today: string): D | null {
  const upcoming = SortedDays(schedule).find((day) => day.date >= today);
  return upcoming === undefined ? null : upcoming;
}

/**
 * The day a card features (badge and time): the next day on or after `today`;
 * when every day is already past, the last one (the event just ended). `null`
 * only for an empty schedule.
 */
export function FeaturedDay<D extends ScheduleDay>(schedule: readonly D[], today: string): D | null {
  const next = NextDay(schedule, today);
  if (next !== null) return next;
  const days = SortedDays(schedule);
  return days.length === 0 ? null : days[days.length - 1];
}
