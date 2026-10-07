/* hooks/useEvents.ts */

"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadEvents = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/events", { credentials: "include", signal });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar eventos.");
        return;
      };

      setEvents(data.events ?? []);
      setError("");
    }

    catch {
      if (!signal?.aborted)
        setError("Erro ao carregar eventos.");
    }

    finally {
      if (!signal?.aborted)
        setLoaded(true);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(controller.signal);

    if (!refreshInterval)
      return () => controller.abort();

    const timer = setInterval(() => loadEvents(), refreshInterval);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadEvents, refreshInterval]);

  /* LIKE AND SUBSCRIBE SHARE THE SAME FLOW: THE SERVER ANSWERS WITH THE NEW TOTALS */
  const toggle = useCallback(async (eventId: string, action: "like" | "subscribe") => {
    setPendingId(eventId);
    setError("");

    try {
      const response = await fetch(`/api/events/${eventId}/${action}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível concluir a ação.");
        return;
      };

      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? {
                ...event,
                likes: data.likes,
                subscriptions: data.subscriptions,
                liked: action === "like" ? data.liked : event.liked,
                subscribed: action === "subscribe" ? data.subscribed : event.subscribed,
              }
            : event
        )
      );
    }

    catch {
      setError("Erro de conexão com o servidor.");
    }

    finally {
      setPendingId(null);
    };
  }, []);

  return {
    events,
    loaded,
    error,
    pendingId,
    toggleLike: (id: string) => toggle(id, "like"),
    toggleSubscription: (id: string) => toggle(id, "subscribe"),
    reload: () => loadEvents(),
  };
};
