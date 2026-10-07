/* utils/date.ts */

/* TODAY IN BRAZIL AS "2026-09-22". THE SERVER USUALLY RUNS IN UTC, SO THE TIME ZONE IS FORCED HERE */
export function TodayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

/* "2026-10-20" -> "20/10/2026" */
export function FromISODate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match)
    return iso;

  const [, year, month, day] = match;

  return `${day}/${month}/${year}`;
};

/* "2026-10-20" -> "terça-feira, 20 de outubro" */
export function LongDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

  if (!match)
    return iso;

  const [, year, month, day] = match.map(Number) as unknown as [string, number, number, number];

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
};

export function IsPastDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso < TodayInBrazil();
};
