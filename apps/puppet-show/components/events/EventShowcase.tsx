/* components/events/EventShowcase.tsx */

"use client";

import { EventCard } from "@/components/events/EventCard";
import type { EventItem } from "@/hooks/useEvents";

type EventShowcaseProps = {
  events: EventItem[];
  loaded: boolean;
};

/* SECONDS EACH EVENT TAKES TO CROSS THE SCREEN */
const SECONDS_PER_EVENT = 6;

/* THE LIST OF THE BIG SCREEN: SCROLLS BY ITSELF, WITHOUT BUTTONS */
export function EventShowcase({ events, loaded }: EventShowcaseProps) {
  if (!loaded) {
    return (
      <p className="center flex-1 opacity-60">
        Carregando eventos...
      </p>
    );
  };

  if (events.length === 0) {
    return (
      <p className="center flex-1 opacity-60">
        Nenhum evento publicado ainda.
      </p>
    );
  };

  /* THE LIST IS RENDERED TWICE: WHEN THE FIRST COPY ENDS, THE SECOND IS ALREADY IN PLACE */
  const duration = `${Math.max(events.length * SECONDS_PER_EVENT, 20)}s`;

  return (
    <div className="marquee flex-1 min-h-0">
      <div
        className="marquee-track column gap-4"
        style={{ ["--marquee-duration" as string]: duration }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="column gap-4" aria-hidden={copy === 1}>
            {events.map((event, index) => (
              <EventCard
                key={`${copy}-${event.id}`}
                event={event}
                position={index + 1}
                showcase
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
