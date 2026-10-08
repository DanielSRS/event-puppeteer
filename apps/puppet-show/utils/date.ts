/**
 * Calendar-date helpers shared by the whole app.
 *
 * Event dates are plain `YYYY-MM-DD` calendar dates. Formatting goes through
 * UTC so a date is never shifted by the browser's time zone. For schedule
 * wording (badges, time ranges, multi-day hints) see `domain/schedule`.
 *
 * @module
 */

/**
 * Today in Brazil as `"2026-09-22"`. Servers usually run in UTC, so the time
 * zone is forced here.
 *
 * @param now - The instant to convert; the current time by default (tests pass a fixed one).
 */
export function TodayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `"2026-10-20"` → `"20/10/2026"`; the input itself when it isn't a `YYYY-MM-DD` date. */
export function FromISODate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** `"2026-10-20"` → `"terça-feira, 20 de outubro"`; the input itself when it isn't a `YYYY-MM-DD` date. */
export function LongDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

/** Whether `iso` is a `YYYY-MM-DD` date before today (in Brazil). */
export function IsPastDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso < TodayInBrazil();
}

/**
 * How long ago something happened, for "Atualizado há 5 s" hints:
 * `"agora"` under a second, `"5 s"`, `"2 min"`.
 */
export function ElapsedLabel(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (seconds < 1) return "agora";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min`;
}
