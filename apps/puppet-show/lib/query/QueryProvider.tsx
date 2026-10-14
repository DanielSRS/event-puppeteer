/**
 * The cache every screen shares, so data survives page changes.
 *
 * Its options are chosen for this app:
 * - `retry: false`: queries resolve to values, never throw, so there is
 *   nothing to retry behind the person's back; a failure is shown and the
 *   screen offers "Tentar de novo".
 * - `refetchOnWindowFocus: false`: the feed polls by itself, and the other
 *   screens refresh when opened (see {@link Freshness}).
 *
 * A session change (login, logout) forgets every answer except the session
 * itself, which is asked again: the old answers belonged to someone else. What
 * is on screen is asked again by its next render, which already knows the new
 * session (a query that needs a login is not asked for after logging out).
 *
 * @module
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AUTH_EVENT } from "@/lib/api/session";
import { KEEP_MS } from "./options";

/** A cache with this app's defaults. */
function NewQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: KEEP_MS } },
  });
}

/** Provides the shared cache to every screen. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(NewQueryClient);

  useEffect(() => {
    const onChange = () => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      void client.invalidateQueries({ queryKey: ["session"] });
    };
    window.addEventListener(AUTH_EVENT, onChange);
    return () => window.removeEventListener(AUTH_EVENT, onChange);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
