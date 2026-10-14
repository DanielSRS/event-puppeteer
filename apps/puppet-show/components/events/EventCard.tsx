/**
 * One event in the public feed.
 *
 * @module
 */

import Link from "next/link";
import { MdAccessTime, MdDateRange, MdDeleteOutline, MdLocationOn } from "react-icons/md";
import type { FeedCard } from "@/domain/feed";
import { FeaturedDay, MultiDayLabel, TimeRange } from "@/domain/schedule";
import { DateBadge, LikeButton, TagChips } from "./EventParts";

export type EventCardProps = {
  card: FeedCard;
  /** `YYYY-MM-DD`; decides which day the badge features. */
  today: string;
  /** While the like request for this card runs. */
  likeBusy?: boolean;
  /** Shown under the actions after an anonymous visitor tried to like this event. */
  loginPrompt?: boolean;
  /** Path to come back to after logging in. */
  loginRedirect?: string;
  onToggleLike: (eventId: string) => void;
  /** Called when the person shows intent to open the event (hover, focus, touch), to load it beforehand. */
  onIntent?: (eventId: string) => void;
  /** Asks to delete the event; only offered to the event's creator and to a Superadmin. */
  onDelete: (eventId: string) => void;
};

/**
 * Calendar badge, title (linking to the details page), time, multi-day hint,
 * place, tags, like button and, on the viewer's own events, "Excluir".
 */
export function EventCard({
  card, today, likeBusy = false, loginPrompt = false, loginRedirect = "/", onToggleLike, onIntent, onDelete,
}: EventCardProps) {
  const day = FeaturedDay(card.schedule, today);
  const multiDay = MultiDayLabel(card.schedule);

  return (
    <article aria-labelledby={`event-${card.id}-title`} className="card column gap-3">
      <div className="flex gap-3">
        <DateBadge date={day === null ? null : day.date} />

        <div className="column gap-1 min-w-0 flex-1">
          <h2 id={`event-${card.id}-title`} className="text-lg font-semibold leading-snug break-words">
            <Link
              href={`/eventos/${card.id}`}
              onMouseEnter={() => onIntent?.(card.id)}
              onFocus={() => onIntent?.(card.id)}
              onTouchStart={() => onIntent?.(card.id)}
              className="hover:text-main hover:underline focus-ring rounded"
            >
              {card.title}
            </Link>
          </h2>

          <p className="row gap-1.5 text-sm text-foreground/80">
            <MdAccessTime aria-hidden className="w-4 h-4 shrink-0" />
            <span>{day === null ? "Sem data definida" : TimeRange(day)}</span>
          </p>

          {multiDay !== null && (
            <p className="row gap-1.5 text-sm text-foreground/80">
              <MdDateRange aria-hidden className="w-4 h-4 shrink-0" />
              <span>{multiDay}</span>
            </p>
          )}

          <p className="row gap-1.5 text-sm text-foreground/80 min-w-0">
            <MdLocationOn aria-hidden className="w-4 h-4 shrink-0" />
            <span className="truncate">{card.location}</span>
          </p>
        </div>
      </div>

      <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-line">{card.description}</p>

      <TagChips tags={card.tags} />

      <div className="flex flex-wrap items-center gap-2">
        <LikeButton
          title={card.title}
          voted={card.voted}
          count={card.voteCount}
          busy={likeBusy}
          onToggle={() => onToggleLike(card.id)}
        />

        <Link
          href={`/eventos/${card.id}`}
          onMouseEnter={() => onIntent?.(card.id)}
          onFocus={() => onIntent?.(card.id)}
          onTouchStart={() => onIntent?.(card.id)}
          className="button clean touch"
          aria-label={`Ver detalhes de “${card.title}”`}
        >
          Ver detalhes
        </Link>

        {card.canDelete && (
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="button clean touch ml-auto text-danger hover:border-danger"
            aria-label={`Excluir “${card.title}”`}
          >
            <MdDeleteOutline aria-hidden className="icon" />
            Excluir
          </button>
        )}
      </div>

      {loginPrompt && (
        <p role="status" className="text-sm rounded-lg border border-main/40 bg-main/10 p-3">
          Você precisa entrar na sua conta para curtir eventos.{" "}
          <Link href={`/entrar?redirect=${encodeURIComponent(loginRedirect)}`} className="text-main underline font-medium">
            Entrar
          </Link>
        </p>
      )}
    </article>
  );
}
