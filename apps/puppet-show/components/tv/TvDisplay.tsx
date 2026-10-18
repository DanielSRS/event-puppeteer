/**
 * The TV display (kiosk mode), bento layout with the banner on the side.
 *
 * - **Em exibição** (the big tile): one event at a time, in the order of
 *   {@link RotationCycle} (the most relevant events come back between the
 *   others), each for `15 s + 1 s × its likes`. Its banner fills the right
 *   side, fading into a blurred copy behind the text; without a banner the
 *   date is drawn large instead. A bar at the bottom shows the time left.
 * - **Hoje**: today's events, or the next one when there are none.
 * - The site's QR code and the count of the next seven days.
 * - **Agenda**: the next events in calendar order.
 *
 * Sizes follow the 1920×1080 design through `--u`, and the grid areas come
 * from `.tv-bento` (see globals.css). Surfaces, colors and theme are the
 * app's: glass cards over the organization's gradient, light or dark.
 *
 * @module
 */

"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { MdCalendarToday, MdFavorite, MdLocationOn } from "react-icons/md";
import { LikesLabel } from "@/components/events/EventParts";
import { QrCodePanel } from "@/components/qrcode/QrCodePanel";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ErrorAlert, LoadingMessage } from "@/components/ui/Feedback";
import { ImageWithPlaceholder, PlaceholderDataUrl } from "@/components/ui/ImageWithPlaceholder";
import type { ImageView } from "@/lib/api/schemas";
import type { TvEvent } from "@/lib/api/mappers";
import { DateBadge as BadgeParts, FeaturedDay, MultiDayLabel, TimeRange } from "@/domain/schedule";
import {
  AgendaOrder, HotEventId, NextAfterToday, NextWindowIndex, RelativeDay, RotationCycle, TodaysEvents,
  ValidWindowIndex, WeekSummary, WindowDurationMs,
} from "@/domain/tv";
import { Monogram } from "@/utils/monogram";

/** Branding of the organization shown on top. */
export type TvBranding = { name: string; logo: ImageView | null };

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

/** `n` pixels of the 1920×1080 design. */
function U(n: number): string {
  return `calc(${n} * var(--u))`;
}

/** Events in the agenda strip. */
const AGENDA_SIZE = 5;

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

/** Today's date in words and the live clock (the page's only `<time>`). */
function Clock() {
  const seconds = useClock();
  const now = seconds === null ? null : new Date(seconds * 1000);
  const date = now === null ? "" : now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  return (
    <div className="row shrink-0 items-baseline" style={{ gap: U(20) }}>
      <p className="t2 font-medium first-letter:uppercase max-sm:hidden" style={{ fontSize: U(22) }}>{date}</p>
      {now === null ? (
        <p aria-hidden className="font-display font-semibold tabular-nums leading-none" style={{ fontSize: U(56) }}>--:--</p>
      ) : (
        <time dateTime={now.toISOString()} className="font-display font-semibold tabular-nums leading-none" style={{ fontSize: U(56) }}>
          {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
        </time>
      )}
    </div>
  );
}

/** "sáb, 17 out · 09:00 – 21:00", or "13 – 17 out · 5 dias · 08:00 – 18:00" for several days. */
function WhenLabel(event: TvEvent, today: string): string {
  const day = FeaturedDay(event.schedule, today);
  if (day === null) return "Sem data definida";
  const span = MultiDayLabel(event.schedule);
  return [RelativeDay(day.date, today), span, TimeRange(day)].filter((part) => part !== null).join(" · ");
}

/** The picture for the big tile: the banner, or its blurred placeholder while it can't be shown. */
function BannerSource(banner: ImageView | null | undefined): string | null {
  if (banner === null || banner === undefined) return null;
  if (banner.url !== undefined) return banner.url;
  const placeholder = PlaceholderDataUrl(banner.thumbhash);
  return placeholder.ok ? placeholder.value : null;
}

/** Fades the side picture into the blurred background, in four layers (stronger blur further left). */
const SIDE_LAYERS: Array<{ blur: number; from: number; to: number; inset: boolean }> = [
  { blur: 32, from: 0, to: 14, inset: true },
  { blur: 14, from: 4, to: 22, inset: true },
  { blur: 5, from: 8, to: 30, inset: true },
  { blur: 0, from: 12, to: 36, inset: false },
];

/** The event on screen now. */
function Featured({ event, today, hot, duration, slot }: { event: TvEvent; today: string; hot: boolean; duration: number; slot: number }) {
  const source = BannerSource(event.banner);
  const day = FeaturedDay(event.schedule, today);
  const badge = day === null ? null : BadgeParts(day.date);
  const tags = event.tags ?? [];

  return (
    <article
      aria-label="Evento em exibição"
      className="glass tv-feature relative min-h-[460px] overflow-hidden lg:min-h-0"
      style={{ borderRadius: U(26) }}
    >
      {source !== null ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative copies of the signed banner URL */}
          <img src={source} alt="" aria-hidden className="pointer-events-none absolute left-[-10%] top-[-10%] h-[120%] w-[120%] object-cover" style={{ filter: `blur(${U(64)}) saturate(1.3)`, opacity: "var(--photo-opacity)" }} />
          <div aria-hidden className="absolute inset-y-0 right-0 left-[30%] overflow-hidden lg:left-[calc(600*var(--u))]">
            {SIDE_LAYERS.map((layer) => {
              const mask = `linear-gradient(90deg, transparent ${layer.from}%, #000 ${layer.to}%)`;
              const style: CSSProperties = {
                filter: layer.blur === 0 ? undefined : `blur(${U(layer.blur)})`,
                WebkitMaskImage: mask,
                maskImage: mask,
                ...(layer.inset
                  ? { left: U(-24), top: U(-24), width: `calc(100% + ${U(48)})`, height: `calc(100% + ${U(48)})` }
                  : { inset: 0, width: "100%", height: "100%" }),
              };
              // eslint-disable-next-line @next/next/no-img-element -- decorative layer of the banner
              return <img key={layer.from} src={source} alt="" className="absolute object-cover" style={style} />;
            })}
          </div>
        </>
      ) : badge !== null && (
        <div aria-hidden className="ink absolute text-right font-display max-lg:hidden" style={{ right: U(64), top: U(36) }}>
          <div className="font-extrabold" style={{ fontSize: U(248), lineHeight: 0.82, letterSpacing: "-0.04em" }}>{badge.day}</div>
          <div className="font-bold uppercase" style={{ fontSize: U(56), letterSpacing: "0.12em", marginTop: U(8) }}>{badge.month}</div>
        </div>
      )}

      <div className="relative flex h-full flex-col p-6 lg:absolute lg:bottom-[calc(56*var(--u))] lg:left-[calc(56*var(--u))] lg:top-[calc(48*var(--u))] lg:h-auto lg:w-[calc(520*var(--u))] lg:p-0">
        <div className="row flex-wrap" style={{ gap: U(10) }}>
          {hot && (
            <span className="row rounded-full bg-accent font-bold text-on-accent" style={{ gap: U(8), padding: `${U(6)} ${U(14)}`, fontSize: U(17) }}>
              <MdFavorite aria-hidden style={{ width: U(18), height: U(18) }} />
              Em alta
            </span>
          )}
          {tags.map((tag) => (
            <span key={tag.id} className="ink rounded-full font-semibold" style={{ background: "var(--accent-soft)", padding: `${U(5)} ${U(14)}`, fontSize: U(17) }}>
              {tag.name}
            </span>
          ))}
        </div>
        <h2 className="line-clamp-2 font-display font-bold" style={{ marginTop: U(18), fontSize: U(58), lineHeight: 1.04, letterSpacing: "-0.02em" }}>
          {event.title}
        </h2>
        {event.description !== undefined && event.description !== "" && (
          <p className="t2 line-clamp-2" style={{ marginTop: U(14), fontSize: U(24), lineHeight: 1.4 }}>{event.description}</p>
        )}
        <div className="min-h-6 flex-1" />
        <div className="column font-medium" style={{ gap: U(12), fontSize: U(26) }}>
          <p className="row" style={{ gap: U(14) }}>
            <MdCalendarToday aria-hidden className="ink shrink-0" style={{ width: U(28), height: U(28) }} />
            <span>{WhenLabel(event, today)}</span>
          </p>
          <p className="row min-w-0" style={{ gap: U(14) }}>
            <MdLocationOn aria-hidden className="ink shrink-0" style={{ width: U(28), height: U(28) }} />
            <span className="truncate">{event.location}</span>
          </p>
        </div>
        <p className="row font-semibold" style={{ marginTop: U(18), gap: U(10), fontSize: U(22) }}>
          <MdFavorite aria-hidden className="ink" style={{ width: U(26), height: U(26) }} />
          {LikesLabel(event.voteCount)}
        </p>
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 bg-foreground/15" style={{ height: U(8) }}>
        <div key={slot} className="tv-progress h-full bg-accent" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </article>
  );
}

/** Start time (or "Dia todo") over "até …", for the compact rows. */
function TimeColumn({ event, today }: { event: TvEvent; today: string }) {
  const day = FeaturedDay(event.schedule, today);
  return (
    <div className="shrink-0 tabular-nums" style={{ width: U(92) }}>
      <div className="ink font-display font-bold leading-none" style={{ fontSize: U(28) }}>
        {day?.startTime ?? "Dia todo"}
      </div>
      {day?.endTime !== undefined && <div className="t3" style={{ fontSize: U(17), marginTop: U(4) }}>até {day.endTime}</div>}
    </div>
  );
}

/** One compact event row (title and place next to the time). */
function EventRow({ event, today }: { event: TvEvent; today: string }) {
  return (
    <div className="well row" style={{ gap: U(18), padding: `${U(14)} ${U(16)}`, borderRadius: U(16) }}>
      <TimeColumn event={event} today={today} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 font-bold leading-tight" style={{ fontSize: U(23) }}>{event.title}</div>
        <div className="t3 truncate" style={{ fontSize: U(18), marginTop: U(2) }}>{event.location}</div>
      </div>
    </div>
  );
}

/** Today's events, or the next one when today has none. */
function Today({ events, today }: { events: TvEvent[]; today: string }) {
  const todays = TodaysEvents(events, today);
  const next = todays.length === 0 ? NextAfterToday(events, today) : null;
  const nextDay = next === null ? null : FeaturedDay(next.schedule, today);
  const shown = todays.slice(0, 2);

  return (
    <section
      aria-labelledby="tv-today"
      className="glass tv-today column"
      style={{ padding: `${U(26)} ${U(28)}`, borderRadius: U(26) }}
    >
      <div className="row" style={{ gap: U(14) }}>
        <h2 id="tv-today" className="font-display font-bold" style={{ fontSize: U(32) }}>Hoje</h2>
        <span className="t2 rounded-full border font-semibold" style={{ padding: `${U(5)} ${U(14)}`, fontSize: U(17), borderColor: "var(--line-2)" }}>
          {todays.length === 0 ? "sem eventos" : todays.length === 1 ? "1 evento" : `${todays.length} eventos`}
        </span>
      </div>

      {todays.length > 0 ? (
        <div className="column" style={{ gap: U(10), marginTop: U(18) }}>
          {shown.map((event) => <EventRow key={event.id} event={event} today={today} />)}
        </div>
      ) : next !== null && nextDay !== null ? (
        <>
          <p className="t2" style={{ margin: `${U(18)} 0 ${U(10)}`, fontSize: U(20) }}>
            O próximo é <strong className="text-foreground">{RelativeDay(nextDay.date, today)}</strong>
          </p>
          <EventRow event={next} today={today} />
        </>
      ) : (
        <p className="t2" style={{ marginTop: U(18), fontSize: U(20) }}>Nenhum outro evento programado por enquanto.</p>
      )}

      <div className="flex-1" />
      {todays.length > shown.length && (
        <p className="t3 truncate" style={{ marginTop: U(12), fontSize: U(18) }}>e mais {todays.length - shown.length} hoje</p>
      )}
    </section>
  );
}

/** "Próximos 7 dias": how many events and in how many categories. */
function Week({ events, today }: { events: TvEvent[]; today: string }) {
  const week = WeekSummary(events, today);
  return (
    <section
      aria-label="Próximos 7 dias"
      className="tv-week column justify-between bg-accent text-on-accent"
      style={{ padding: `${U(26)} ${U(28)}`, borderRadius: U(26), gap: U(12), boxShadow: "0 20px 50px -24px var(--accent)" }}
    >
      <p className="font-bold uppercase" style={{ fontSize: U(19), letterSpacing: "0.04em" }}>Próximos 7 dias</p>
      <div>
        <div className="font-display font-extrabold" style={{ fontSize: U(104), lineHeight: 0.9, letterSpacing: "-0.03em" }}>{week.events}</div>
        <div className="font-bold" style={{ fontSize: U(24), marginTop: U(4) }}>{week.events === 1 ? "evento" : "eventos"}</div>
      </div>
      <p className="font-semibold opacity-85" style={{ fontSize: U(18) }}>
        {week.categories === 0 ? " " : week.categories === 1 ? "em 1 categoria" : `em ${week.categories} categorias`}
      </p>
    </section>
  );
}

/** The next events in calendar order. */
function Agenda({ events, today }: { events: TvEvent[]; today: string }) {
  const ordered = AgendaOrder(events, today);
  const shown = ordered.slice(0, AGENDA_SIZE);
  const rest = ordered.length - shown.length;

  return (
    <section aria-labelledby="tv-agenda" className="column" style={{ marginTop: U(36), gap: U(16) }}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="tv-agenda" className="font-display font-bold" style={{ fontSize: U(34) }}>Agenda</h2>
        {rest > 0 && <span className="t3" style={{ fontSize: U(20) }}>e mais {rest} {rest === 1 ? "evento" : "eventos"} no site</span>}
      </div>
      <ul aria-labelledby="tv-agenda" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ gap: U(24) }}>
        {shown.map((event) => {
          const day = FeaturedDay(event.schedule, today);
          const badge = day === null ? null : BadgeParts(day.date);
          return (
            <li
              key={event.id}
              className="glass column lg:h-[calc(184*var(--u))]"
              style={{ padding: `${U(20)} ${U(22)}`, borderRadius: U(22), gap: U(12) }}
            >
              <div className="flex items-start" style={{ gap: U(16) }}>
                <div aria-hidden className="column center shrink-0 bg-accent text-on-accent" style={{ width: U(64), height: U(64), borderRadius: U(14) }}>
                  <span className="font-display font-extrabold leading-none" style={{ fontSize: U(28) }}>{badge?.day ?? "–"}</span>
                  <span className="font-bold uppercase" style={{ fontSize: U(14), letterSpacing: "0.06em" }}>{badge?.month ?? ""}</span>
                </div>
                <h3 className="line-clamp-2 font-bold" style={{ fontSize: U(22), lineHeight: 1.25 }}>{event.title}</h3>
              </div>
              <div className="t2 column" style={{ gap: U(4), fontSize: U(18) }}>
                <div className="between" style={{ gap: U(12) }}>
                  <span>{day === null ? "Sem data definida" : TimeRange(day)}</span>
                  <span role="img" aria-label={LikesLabel(event.voteCount)} className="row font-semibold tabular-nums text-foreground" style={{ gap: U(6) }}>
                    <MdFavorite aria-hidden className="ink" style={{ width: U(18), height: U(18) }} />
                    <span aria-hidden>{event.voteCount}</span>
                  </span>
                </div>
                <span className="truncate">{event.location}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The whole screen. */
export function TvDisplay({ branding, status, events, errors, qr, today }: TvDisplayProps) {
  const cycle = useMemo(() => RotationCycle(events, today), [events, today]);
  const hotId = useMemo(() => HotEventId(events), [events]);
  const [rawSlot, setSlot] = useState(0);
  const slot = ValidWindowIndex(rawSlot, cycle.length);
  const featured = cycle.length === 0 ? null : cycle[slot];
  const duration = WindowDurationMs(featured === null ? [] : [featured]);

  useEffect(() => {
    if (cycle.length <= 1) return;
    const timer = setTimeout(() => setSlot(NextWindowIndex(slot, cycle.length)), duration);
    return () => clearTimeout(timer);
  }, [slot, cycle.length, duration]);

  const shownErrors = errors.filter((error): error is string => error !== null && error !== "");
  const name = branding === null ? null : branding.name;

  return (
    <main
      className="tv flex min-h-dvh w-full min-w-0 flex-col text-foreground lg:h-dvh lg:overflow-hidden"
      style={{ padding: `${U(44)} ${U(48)} ${U(48)}` }}
    >
      <header className="flex flex-wrap items-center justify-between" style={{ minHeight: U(72), gap: U(32) }}>
        <div className="row min-w-0" style={{ gap: U(20) }}>
          {branding !== null && branding.logo !== null ? (
            <span aria-hidden className="shrink-0">
              <ImageWithPlaceholder image={branding.logo} alt={`Logo de ${branding.name}`} className="h-[calc(64*var(--u))] w-[calc(64*var(--u))] rounded-[calc(16*var(--u))]" compact />
            </span>
          ) : (
            <span aria-hidden className="center shrink-0 bg-accent font-display font-extrabold text-on-accent" style={{ width: U(64), height: U(64), borderRadius: U(16), fontSize: U(19) }}>
              {Monogram(name ?? "Mural de Eventos")}
            </span>
          )}
          <h1 id="tv-title" className="min-w-0 font-display font-bold lg:truncate" style={{ fontSize: U(36), letterSpacing: "-0.01em" }}>
            {name === null ? "Mural de Eventos" : <>Eventos <span className="t3 font-semibold">· {name}</span></>}
          </h1>
        </div>
        <Clock />
      </header>

      {shownErrors.length > 0 && (
        <div className="column" style={{ gap: U(12), marginTop: U(20) }}>
          {shownErrors.map((error) => <ErrorAlert key={error} className="text-lg">{error}</ErrorAlert>)}
        </div>
      )}

      {status === "loading" && <LoadingMessage className="text-2xl">Carregando eventos...</LoadingMessage>}

      {status === "ready" && events.length === 0 && (
        <p className="glass t2 text-center" style={{ marginTop: U(28), padding: U(64), borderRadius: U(26), fontSize: U(32) }}>
          Nenhum evento programado por enquanto.
        </p>
      )}

      <section
        aria-label="Destaques"
        className="tv-bento"
        style={{ marginTop: U(28) }}
      >
        {featured !== null && (
          <Featured event={featured} today={today} hot={featured.id === hotId} duration={duration} slot={slot} />
        )}
        {events.length > 0 && <Today events={events} today={today} />}
        <div
          className="glass tv-qr center"
          style={{ padding: U(20), borderRadius: U(26) }}
        >
          <QrCodePanel qr={qr} variant="tv" />
        </div>
        {events.length > 0 && <Week events={events} today={today} />}
      </section>

      {events.length > 0 && <Agenda events={events} today={today} />}
    </main>
  );
}
