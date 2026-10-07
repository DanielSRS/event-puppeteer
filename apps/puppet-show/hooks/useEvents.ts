/* hooks/useEvents.ts */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { DEFAULT_ORG_ID } from "@/lib/api/session";
import { ToEventItem } from "@/lib/api/mappers";
import { UserOrgId } from "@/lib/api/types";
import { useAuth } from "@/hooks/useAuth";

export type EventItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  authorName: string;
  likes: number;
  subscriptions: number;
  liked: boolean;
  subscribed: boolean;
};

type UseEventsOptions = {
  /* THE BIG SCREEN KEEPS REFRESHING BY ITSELF SO THE ORDER FOLLOWS THE LIKES */
  refreshInterval?: number;
};

export function useEvents({ refreshInterval }: UseEventsOptions = {}) {
  const { user, loading: authLoading } = useAuth();
  const orgId = UserOrgId(user) ?? DEFAULT_ORG_ID;

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  /* THE FEED DOESN'T SAY WHAT THE VIEWER LIKED, SO WE KEEP IT ACROSS REFRESHES */
  const likedRef = useRef(new Set<string>());

  const loadEvents = useCallback(async () => {
    try {
      const feed = await api.organizations.feed(orgId);

      setEvents(feed.map((event) => ({ ...ToEventItem(event), liked: likedRef.current.has(event.id) })));
      setError("");
    }

    catch {
      setError("Erro ao carregar eventos.");
    }

    finally {
      setLoaded(true);
    };
  }, [orgId]);

  useEffect(() => {
    /* WAITS FOR THE SESSION SO WE ASK FOR THE RIGHT ORGANIZATION'S FEED */
    if (authLoading)
      return;

    loadEvents();

    if (!refreshInterval)
      return;

    const timer = setInterval(loadEvents, refreshInterval);
    return () => clearInterval(timer);
  }, [authLoading, loadEvents, refreshInterval]);

  const toggleLike = useCallback(async (eventId: string) => {
    if (!user) {
      setError("Entre na sua conta para curtir eventos.");
      return;
    };

    setPendingId(eventId);
    setError("");

    try {
      const { status } = await api.events.vote(orgId, eventId);
      const liked = status === "voted";

      if (liked) likedRef.current.add(eventId);
      else likedRef.current.delete(eventId);

      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, liked, likes: Math.max(0, event.likes + (liked ? 1 : -1)) }
            : event
        )
      );
    }

    catch {
      setError("Não foi possível concluir a ação.");
    }

    finally {
      setPendingId(null);
    };
  }, [user, orgId]);

  /* THE API HAS NO SUBSCRIPTIONS YET */
  const toggleSubscription = useCallback(() => {
    setError("Inscrições ainda não estão disponíveis.");
  }, []);

  return {
    events,
    loaded,
    error,
    pendingId,
    toggleLike,
    toggleSubscription,
    reload: loadEvents,
  };
};
