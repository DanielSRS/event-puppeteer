/**
 * The rail beside the hero on large screens: the events of the next seven
 * days as compact links, and the site's QR code at its foot.
 *
 * @module
 */

import Link from "next/link";
import { useId } from "react";
import { NO_BANNER_BACKGROUND } from "@/components/events/EventCard";
import { QrCodePanel } from "@/components/qrcode/QrCodePanel";
import type { SiteQr } from "@/components/qrcode/siteQrCode";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { FeedCard } from "@/domain/feed";
import { DateBadge as BadgeParts, NextDay, ShortDate } from "@/domain/schedule";
import { AddDays, WEEK_DAYS } from "./week-picks";

/** How many events the rail lists at most. */
const RAIL_SIZE = 4;

export type WeekRailProps = {
  /** The next seven days' cards, soonest first (see `WeekCards`). */
  cards: FeedCard[];
  /** `YYYY-MM-DD` in Brazil. */
  today: string;
  qr: SiteQr;
  /** Called when the person shows intent to open an event, to load it beforehand. */
  onIntent?: (eventId: string) => void;
};

/** One event of the rail: thumbnail, when (or "Hoje"), title and place. */
function RailItem({ card, today, onIntent }: { card: FeedCard; today: string; onIntent?: (eventId: string) => void }) {
  const day = NextDay(card.schedule, today);
  const badge = day === null ? null : BadgeParts(day.date);
  const isToday = day !== null && day.date === today;
  const time = day === null || day.startTime === undefined ? "dia todo" : day.startTime;

  return (
    <li>
      <Link
        href={`/eventos/${card.id}`}
        onMouseEnter={() => onIntent?.(card.id)}
        onFocus={() => onIntent?.(card.id)}
        onTouchStart={() => onIntent?.(card.id)}
        className="nav-item focus-ring gap-3.5 rounded-[18px] p-2.5 text-foreground"
      >
        <span aria-hidden className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px]">
          {card.banner != null ? (
            <ImageWithPlaceholder image={card.banner} alt="" className="h-full w-full" />
          ) : (
            <span className="center h-full w-full font-display text-xl font-bold text-foreground" style={{ background: NO_BANNER_BACKGROUND }}>
              {badge === null ? "" : badge.day}
            </span>
          )}
        </span>
        <span className="column min-w-0 gap-[3px]">
          {isToday ? (
            <span className="ink row gap-1.5 text-xs font-semibold">
              <span aria-hidden className="h-[7px] w-[7px] shrink-0 animate-pulse rounded-full bg-current" />
              Hoje · {time}
            </span>
          ) : (
            <span className="t3 font-mono text-xs uppercase">{day === null ? "" : `${ShortDate(day.date)} · ${time}`}</span>
          )}
          <span className="truncate font-semibold">{card.title}</span>
          <span className="t3 truncate text-[13px]">{card.location}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Heading with the date range, up to {@link RAIL_SIZE} events, then the QR
 * code; with nothing in the next seven days only the QR code remains.
 */
export function WeekRail({ cards, today, qr, onIntent }: WeekRailProps) {
  const titleId = useId();
  const listed = cards.slice(0, RAIL_SIZE);

  return (
    <aside
      aria-labelledby={listed.length > 0 ? titleId : undefined}
      aria-label={listed.length > 0 ? undefined : "Acesse pelo celular"}
      className="glass hidden min-w-0 flex-[1_1_320px] flex-col gap-1.5 rounded-[32px] p-5 lg:flex"
    >
      {listed.length > 0 && (
        <>
          <div className="between gap-3 px-1.5 pb-2.5">
            <h2 id={titleId} className="h2 text-xl">Próximos {WEEK_DAYS} dias</h2>
            <span className="t3 font-mono text-xs uppercase">{ShortDate(today)} — {ShortDate(AddDays(today, WEEK_DAYS - 1))}</span>
          </div>
          <ul className="column gap-1.5">
            {listed.map((card) => <RailItem key={card.id} card={card} today={today} onIntent={onIntent} />)}
          </ul>
        </>
      )}

      <div className={listed.length > 0 ? "mt-auto border-t border-[var(--line)] px-1.5 pt-4" : "px-1.5"}>
        <QrCodePanel qr={qr} />
      </div>
    </aside>
  );
}
