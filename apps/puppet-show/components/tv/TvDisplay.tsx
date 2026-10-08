/**
 * The TV display (kiosk mode): the organization's upcoming events rotating in
 * windows of three, a clock and the QR code to the site.
 *
 * @module
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MdAccessTime, MdFavorite, MdLocationOn } from "react-icons/md";
import { DateBadge } from "@/components/events/EventParts";
import { QrCodePanel } from "@/components/qrcode/QrCodePanel";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import type { TvEvent } from "@/lib/api/mappers";
import { FeaturedDay, MultiDayLabel, TimeRange } from "@/domain/schedule";
import { NextWindowIndex, TvWindows, ValidWindowIndex, WindowDurationMs } from "@/domain/tv";
import { LikesLabel } from "@/components/events/EventParts";

/** Branding of the organization shown on top. */
export type TvBranding = { name: string; logo: string | null };

export type TvDisplayProps = {
  /** `null` while loading or when it failed (see `errors`). */
  branding: TvBranding | null;
  /** `"loading"` before the first feed answer, `"ready"` after. */
  status: "loading" | "ready";
  events: TvEvent[];
  /** Every problem to show on screen (a kiosk has nobody to ask). Empty entries are skipped. */
  errors: Array<string | null>;
  qr: SiteQr;
  /** `YYYY-MM-DD` in Brazil. */
  today: string;
};

/** Seconds since epoch, ticking once a second; `null` during server rendering. */
function useClock(): number | null {
  return useSyncExternalStore(
    (notify) => {
      const timer = setInterval(notify, 1000);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
}

/** Live clock and date, in Portuguese. */
function Clock() {
  const seconds = useClock();
  if (seconds === null) return <p className="text-6xl font-light tabular-nums" aria-hidden>--:--</p>;
  const now = new Date(seconds * 1000);
  return (
    <div className="column items-center">
      <time dateTime={now.toISOString()} className="text-5xl lg:text-6xl font-light tabular-nums">
        {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
      </time>
      <p className="text-lg text-foreground/80 first-letter:uppercase">
        {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}
      </p>
    </div>
  );
}

/** One event, large. */
function TvCard({ event, today }: { event: TvEvent; today: string }) {
  const day = FeaturedDay(event.schedule, today);
  const multiDay = MultiDayLabel(event.schedule);
  return (
    <li className="card flex gap-4 lg:gap-6 items-center">
      <DateBadge date={day === null ? null : day.date} size="lg" />
      <div className="column gap-1 min-w-0 flex-1">
        <h2 className="text-2xl lg:text-3xl font-bold text-main break-words">{event.title}</h2>
        <p className="row gap-2 text-lg lg:text-xl">
          <MdAccessTime aria-hidden className="shrink-0" />
          {day === null ? "Sem data definida" : TimeRange(day)}
          {multiDay !== null && <span className="text-foreground/80">· {multiDay}</span>}
        </p>
        <p className="row gap-2 text-lg text-foreground/80 min-w-0">
          <MdLocationOn aria-hidden className="shrink-0" />
          <span className="truncate">{event.location}</span>
        </p>
      </div>
      <p className="column items-center shrink-0 text-main">
        <MdFavorite aria-hidden className="w-8 h-8" />
        <span aria-hidden className="text-2xl font-semibold tabular-nums">{event.voteCount}</span>
        <span className="sr-only">{LikesLabel(event.voteCount)}</span>
      </p>
    </li>
  );
}

/**
 * Rotates through windows of three events; each window stays
 * `15 s + 1 s × its votes` (see `domain/tv`). Three events or fewer: one
 * window, no rotation, no repetition.
 */
export function TvDisplay({ branding, status, events, errors, qr, today }: TvDisplayProps) {
  const windows = TvWindows(events);
  const [rawIndex, setIndex] = useState(0);
  const index = ValidWindowIndex(rawIndex, windows.length);
  const current = windows.length === 0 ? [] : windows[index];
  const duration = WindowDurationMs(current);

  useEffect(() => {
    if (windows.length <= 1) return;
    const timer = setTimeout(() => setIndex(NextWindowIndex(index, windows.length)), duration);
    return () => clearTimeout(timer);
  }, [index, windows.length, duration]);

  const shownErrors = errors.filter((error): error is string => error !== null && error !== "");

  return (
    <main className="min-h-dvh w-full flex flex-col lg:flex-row bg-background text-foreground">
      <section aria-labelledby="tv-title" className="flex-1 min-w-0 column gap-6 p-4 lg:p-8">
        <header className="row gap-4 border-b border-muted pb-4 min-w-0">
          {branding !== null && branding.logo !== null && (
            <div role="img" aria-label={`Logo de ${branding.name}`} className="w-14 h-14 shrink-0 rounded-lg bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(branding.logo)})` }} />
          )}
          <h1 id="tv-title" className="text-3xl lg:text-4xl font-bold break-words min-w-0">
            {branding === null ? "Mural de Eventos" : `Eventos · ${branding.name}`}
          </h1>
        </header>

        {shownErrors.map((error) => <ErrorAlert key={error} className="text-lg">{error}</ErrorAlert>)}

        {status === "loading" && <LoadingMessage className="text-2xl">Carregando eventos...</LoadingMessage>}

        {status === "ready" && events.length === 0 && (
          <p className="card text-center text-2xl py-16">Nenhum evento programado por enquanto.</p>
        )}

        {current.length > 0 && (
          <>
            <ul aria-label="Eventos em exibição" className="column gap-4 lg:gap-6">
              {current.map((event) => <TvCard key={event.id} event={event} today={today} />)}
            </ul>
            {windows.length > 1 && (
              <p className="text-foreground/80 text-lg" aria-live="polite">
                Página {index + 1} de {windows.length}
              </p>
            )}
          </>
        )}
      </section>

      <aside aria-label="Relógio e acesso pelo celular" className="lg:w-96 shrink-0 bg-surface border-t lg:border-t-0 lg:border-l border-muted p-4 lg:p-8 column items-center gap-8 lg:justify-between">
        <Clock />
        <QrCodePanel qr={qr} variant="tv" />
      </aside>
    </main>
  );
}
