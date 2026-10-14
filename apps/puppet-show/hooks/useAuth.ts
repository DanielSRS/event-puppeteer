/**
 * The logged-in user, shared by every component that asks for it.
 *
 * The session is one cached query (see `sessionQuery`): the API is asked once
 * and every component reads the same answer, also across page changes.
 *
 * @module
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_EVENT, SetToken, STORAGE_UNAVAILABLE_MESSAGE } from "@/lib/api/session";
import { sessionQuery, type AuthState } from "@/lib/query/queries";
import { Err, Ok, type Result } from "@/lib/result";

export type { AuthState };

/** Tells the app the session changed, so what was cached for the previous one is dropped. */
export function NotifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Stores the token returned by login and tells the app the session changed.
 *
 * @returns An error message for the person when the browser refuses to store it.
 */
export function StartSession(token: string): Result<void, string> {
  const saved = SetToken(token);
  if (!saved.ok) return Err(STORAGE_UNAVAILABLE_MESSAGE);
  NotifyAuthChange();
  return Ok(undefined);
}

/**
 * The current session and a way to end it.
 *
 * `user` is a shortcut for `state.user` when authenticated, `null` otherwise.
 * `logout` returns an error message when the browser refuses to clear the token.
 */
export function useAuth() {
  const router = useRouter();
  const client = useQueryClient();
  const session = useQuery(sessionQuery());
  const state: AuthState = session.data === undefined ? { status: "loading" } : session.data;

  const logout = useCallback((): Result<void, string> => {
    const cleared = SetToken(null);
    if (!cleared.ok) return Err(STORAGE_UNAVAILABLE_MESSAGE);

    client.setQueryData(sessionQuery().queryKey, { status: "anonymous" } satisfies AuthState);
    NotifyAuthChange();
    router.push("/");
    router.refresh();
    return Ok(undefined);
  }, [client, router]);

  return {
    state,
    user: state.status === "authenticated" ? state.user : null,
    loading: state.status === "loading",
    logout,
  };
}
