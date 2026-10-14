/**
 * The feed's hero: the most liked event of the next seven days, drawn over its
 * banner (or the organization's gradient) with white text on a dark scrim.
 *
 * It repeats an event that also has its card below, so it is a `<section>`,
 * not an `<article>`, and it holds no like button: liking stays on the card.
 *
 * @module
 */

import Link from "next/link";
import { MdAccessTime, MdArrowForward, MdCalendarToday, MdFavorite, MdLocationOn } from "react-icons/md";
import { NO_BANNER_BACKGROUND } from "@/components/events/EventCard";
import { LikesLabel } from "@/components/events/EventParts";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import type { FeedCard } from "@/domain/feed";
import { FeaturedDay, MultiDayLabel, ShortDate, SortedDays, TimeRange } from "@/domain/schedule";
import { LongDate } from "@/utils/date";

/** Darkens the bottom of the picture so the white text reads on any banner. */
const SCRIM = "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(5,5,8,.55) 62%, rgba(5,5,8,.9) 100%)";

/** The design's fixed "liked" pink. */
const LIKED_PINK = "#FF6B8A";

export type FeaturedEventProps = {
  card: FeedCard;
  /** `YYYY-MM-DD`; decides which day the hero features. */
  today: string;
  /** Called when the person shows intent to open the event, to load it beforehand. */
  onIntent?: (eventId: string) => void;
};

/** `"quinta-feira, 15 de outubro"` for one day, `"17 out – 18 out"` for several. */
function DatesLabel(card: FeedCard): string {
  const days = SortedDays(card.schedule);
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) return "Sem data definida";
  return days.length === 1 ? LongDate(first.date) : `${ShortDate(first.date)} – ${ShortDate(last.date)}`;
}

/** Badge, like count, tags, title, when and where, and "Ver detalhes". */
export function FeaturedEvent({ card, today, onIntent }: FeaturedEventProps) {
  const day = FeaturedDay(card.schedule, today);
  const multiDay = MultiDayLabel(card.schedule);
  const titleId = `featured-${card.id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="group relative flex min-h-[420px] min-w-0 flex-[999_1_600px] flex-col justify-end overflow-hidden rounded-[30px] border border-[var(--line-2)] text-white shadow-[0_40px_80px_-40px_rgba(0,0,0,.6)] lg:min-h-[540px] lg:rounded-[32px]"
    >
      <div aria-hidden className="absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-105">
        {card.banner != null
          ? <ImageWithPlaceholder image={card.banner} alt="" className="h-full w-full" />
          : <div className="h-full w-full" style={{ background: NO_BANNER_BACKGROUND }} />}
      </div>
      <div aria-hidden className="absolute inset-0" style={{ background: SCRIM }} />

      <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-3 lg:inset-x-5 lg:top-5">
        <span className="glass-photo rounded-full px-3 py-1.5 text-xs font-medium lg:px-3.5 lg:py-2 lg:text-[13px]">
          Em destaque<span className="hidden sm:inline"> · mais curtido da semana</span>
        </span>
        <span className="glass-photo row gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold lg:px-3.5 lg:py-2">
          <MdFavorite aria-hidden className="h-4 w-4" style={{ color: LIKED_PINK }} />
          <span aria-hidden className="font-mono">{card.voteCount}</span>
          <span className="sr-only">{LikesLabel(card.voteCount)}</span>
        </span>
      </div>

      <div className="relative column gap-3 p-[22px] lg:gap-[18px] lg:p-9">
        {(card.tags.length > 0 || multiDay !== null) && (
          <ul aria-label="Categorias e duração" className="flex flex-wrap gap-2">
            {card.tags.map((tag) => (
              <li key={tag.id} className="rounded-full bg-white/16 px-3 py-1 text-[13px] font-medium">{tag.name}</li>
            ))}
            {multiDay !== null && <li className="rounded-full bg-white/16 px-3 py-1 text-[13px] font-medium">{multiDay}</li>}
          </ul>
        )}

        <h2
          id={titleId}
          className="max-w-[13ch] font-display text-[38px] font-bold leading-[.98] tracking-[-.035em] break-words lg:text-[clamp(40px,5.4vw,76px)] lg:leading-[.96]"
        >
          {card.title}
        </h2>

        <div className="flex flex-wrap gap-x-[22px] gap-y-2 text-sm text-white/88 lg:text-[15px]">
          <span className="row gap-2">
            <MdCalendarToday aria-hidden className="h-4 w-4 shrink-0" />
            <span className="first-letter:uppercase">{DatesLabel(card)}</span>
          </span>
          {day !== null && (
            <span className="row gap-2">
              <MdAccessTime aria-hidden className="h-4 w-4 shrink-0" />
              {TimeRange(day)}
            </span>
          )}
          <span className="row min-w-0 gap-2">
            <MdLocationOn aria-hidden className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{card.location}</span>
          </span>
        </div>

        <div className="pt-1">
          <Link
            href={`/eventos/${card.id}`}
            onMouseEnter={() => onIntent?.(card.id)}
            onFocus={() => onIntent?.(card.id)}
            onTouchStart={() => onIntent?.(card.id)}
            aria-label={`Ver detalhes de “${card.title}”`}
            className="button main focus-ring min-h-12 rounded-2xl px-[22px] text-[15px]"
          >
            Ver detalhes
            <MdArrowForward aria-hidden className="icon" />
          </Link>
        </div>
      </div>
    </section>
  );
}
