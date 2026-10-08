/**
 * The logged-in user, shared by every component that asks for it.
 *
 * @module
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { GetToken, SetToken, STORAGE_UNAVAILABLE_MESSAGE } from "@/lib/api/session";
import type { User } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";

/** Window event that tells every {@link useAuth} the session changed. */
const AUTH_EVENT = "auth-change";

/** Where the session stands. */
export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User }
  /** The session couldn't be read; `message` says why, for the person. */
  | { status: "error"; message: string };

/** Wakes up every mounted {@link useAuth} so it reloads the session. */
export function NotifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Stores the token returned by login and wakes up every {@link useAuth}.
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
 * Reads the saved token and asks the API who it belongs to. An expired or
 * revoked token (401) means "logged out": it is forgotten so it stops being sent.
 */
async function LoadSession(): Promise<AuthState> {
  const token = GetToken();
  if (!token.ok) return { status: "error", message: STORAGE_UNAVAILABLE_MESSAGE };
  if (token.value === null) return { status: "anonymous" };

  const me = await api.auth.me();
  if (me.ok) return { status: "authenticated", user: me.value };

  if (me.error.kind === "http" && me.error.status === 401) {
    const cleared = SetToken(null);
    return cleared.ok ? { status: "anonymous" } : { status: "error", message: STORAGE_UNAVAILABLE_MESSAGE };
  }

  return { status: "error", message: ApiErrorMessage(me.error) };
}

/**
 * The current session and a way to end it.
 *
 * `user` is a shortcut for `state.user` when authenticated, `null` otherwise.
 * `logout` returns an error message when the browser refuses to clear the token.
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const load = () => {
      LoadSession().then((next) => { if (active) setState(next); });
    };

    load();
    window.addEventListener(AUTH_EVENT, load);

    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, load);
    };
  }, []);

  const logout = useCallback((): Result<void, string> => {
    const cleared = SetToken(null);
    if (!cleared.ok) return Err(STORAGE_UNAVAILABLE_MESSAGE);

    setState({ status: "anonymous" });
    NotifyAuthChange();
    router.push("/");
    router.refresh();
    return Ok(undefined);
  }, [router]);

  return {
    state,
    user: state.status === "authenticated" ? state.user : null,
    loading: state.status === "loading",
    logout,
  };
}
