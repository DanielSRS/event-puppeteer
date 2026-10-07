/* components/events/EventCard.tsx */

"use client";

import { MdFavorite, MdFavoriteBorder, MdCheckCircle, MdEventAvailable } from "react-icons/md";
import type { EventItem } from "@/hooks/useEvents";
import { FromISODate, LongDate } from "@/utils/date";

type EventCardProps = {
  event: EventItem;
  position: number;
  /* THE BIG SCREEN ONLY SHOWS THE EVENT, WITHOUT BUTTONS */
  showcase?: boolean;
  pending?: boolean;
  onToggleLike?: (id: number) => void;
  onToggleSubscription?: (id: number) => void;
};

export function EventCard({
  event,
  position,
  showcase = false,
  pending = false,
  onToggleLike,
  onToggleSubscription,
}: EventCardProps) {
  return (
    <article className="card column gap-3">
      <div className="between gap-3">
        <div className="column min-w-0">
          <span className="text-xs opacity-60">
            #{position} • {event.authorName}
          </span>

          <h3 className={`${showcase ? "text-xl" : "subtitle"} truncate`} title={event.title}>
            {event.title}
          </h3>
        </div>

        <div className="column items-end shrink-0">
          <span className="text-main text-lg font-semibold">
            {event.likes}
          </span>

          <span className="text-xs opacity-60">
            {event.likes === 1 ? "curtida" : "curtidas"}
          </span>
        </div>
      </div>

      <p className={`text-sm opacity-80 ${showcase ? "line-clamp-2" : "whitespace-pre-line"}`}>
        {event.description}
      </p>

      <div className="column gap-1 text-sm">
        <span>
          <span className="opacity-60">Quando: </span>
          <span className="hidden sm:inline">{LongDate(event.date)}</span>
          <span className="sm:hidden">{FromISODate(event.date)}</span>
          {" às "}
          {event.time}
        </span>

        <span className="truncate">
          <span className="opacity-60">Onde: </span>
          {event.location}
        </span>

        <span className="text-xs opacity-60">
          {event.subscriptions} inscrito{event.subscriptions === 1 ? "" : "s"}
        </span>
      </div>

      {!showcase && (
        <div className="row gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onToggleLike?.(event.id)}
            className={`button clean flex-1 ${event.liked ? "text-main border-main" : ""}`}
            aria-pressed={event.liked}
          >
            {event.liked ? <MdFavorite className="icon" /> : <MdFavoriteBorder className="icon" />}
            {event.liked ? "Curtido" : "Curtir"}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => onToggleSubscription?.(event.id)}
            className={`button flex-1 ${event.subscribed ? "clean text-success border-success" : "main"}`}
            aria-pressed={event.subscribed}
          >
            {event.subscribed ? <MdCheckCircle className="icon" /> : <MdEventAvailable className="icon" />}
            {event.subscribed ? "Inscrito" : "Inscrever"}
          </button>
        </div>
      )}
    </article>
  );
};
