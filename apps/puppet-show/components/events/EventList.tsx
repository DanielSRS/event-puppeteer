/* components/events/EventList.tsx */

"use client";

import Link from "next/link";
import { EventCard } from "@/components/events/EventCard";
import type { EventItem } from "@/hooks/useEvents";
import { useAuth } from "@/hooks/useAuth";

type EventListProps = {
  events: EventItem[];
  loaded: boolean;
  error: string;
  pendingId: string | null;
  onToggleLike: (id: string) => void;
  onToggleSubscription: (id: string) => void;
};

/* THE LIST PEOPLE USE ON THE PHONE: LIKE AND SUBSCRIBE */
export function EventList({
  events,
  loaded,
  error,
  pendingId,
  onToggleLike,
  onToggleSubscription,
}: EventListProps) {
  const { user, loading } = useAuth();

  if (!loaded) {
    return (
      <p className="center py-16 opacity-60">
        Carregando eventos...
      </p>
    );
  };

  return (
    <div className="column gap-4">
      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      {!loading && !user && events.length > 0 && (
        <p className="card text-sm opacity-80">
          <Link href="/entrar" className="text-main underline">
            Entre na sua conta
          </Link>{" "}
          para curtir e se inscrever nos eventos.
        </p>
      )}

      {events.length === 0 ? (
        <div className="card center column gap-2 py-12 text-center">
          <p>
            Nenhum evento publicado ainda.
          </p>

          <Link href="/eventos/novo" className="button main">
            Publicar o primeiro
          </Link>
        </div>
      ) : (
        events.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            position={index + 1}
            pending={pendingId === event.id}
            onToggleLike={onToggleLike}
            onToggleSubscription={onToggleSubscription}
          />
        ))
      )}
    </div>
  );
};
