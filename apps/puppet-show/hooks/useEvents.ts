/**
 * The public feed with live-ish like counters, for the home page.
 *
 * @module
 */

"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "@/lib/api/session";
import { UserOrgId, type FeedEvent, type Tag, type User } from "@/lib/api/schemas";
import { ToFeedCard } from "@/lib/api/mappers";
import type { FeedCard } from "@/domain/feed";
import { ConfirmVote, IsVoteInFlight, SettleVotes, StartVote, type PendingVote, type PendingVotes } from "@/domain/likes";
import { Err, Ok, type Result } from "@/lib/result";

/** How often the feed is fetched again while the tab is visible. */
export const FEED_REFRESH_MS = 5_000;

/**
 * Whose feed a viewer sees: their own organization's when they belong to one,
 * otherwise (anonymous visitors and the Superadmin, who has none) the public
 * organization configured in `NEXT_PUBLIC_ORG_ID`, which may be missing.
 */
export function FeedOrgId(user: User | null): string | null {
  const own = user === null ? null : UserOrgId(user);
  return own !== null ? own : PUBLIC_ORG_ID;
}

/** Where the feed stands. */
export type FeedStatus =
  | { kind: "loading" }
  /** Nothing could be loaded; `message` says why. */
  | { kind: "error"; message: string }
  | { kind: "ready" };

type State = {
  /** Last feed answer, in the API's ranking; `null` before the first one. */
  feed: FeedEvent[] | null;
  /** Generation of the fetch that produced `feed` (older answers arriving late are ignored). */
  generation: number;
  /** When `feed` arrived (ms since epoch). */
  updatedAt: number | null;
  /** Why the first load failed. */
  loadError: string | null;
  /** Why the latest refresh failed while older data is still shown. */
  refreshError: string | null;
  /** The viewer's confirmed vote per event (logged-in viewers only). */
  viewerVotes: Readonly<Record<string, boolean>>;
  pending: PendingVotes;
  /** Pending entry before the click in flight, to restore it if the vote fails. */
  rollback: Readonly<Record<string, PendingVote | undefined>>;
  /** Why the last like failed. */
  likeError: string | null;
};

type Action =
  | { type: "reset" }
  | { type: "feed-loaded"; generation: number; feed: FeedEvent[]; votes: Record<string, boolean>; at: number }
  | { type: "feed-failed"; message: string }
  | { type: "vote-started"; id: string }
  | { type: "vote-confirmed"; id: string; voted: boolean; nextGeneration: number }
  | { type: "vote-failed"; id: string; message: string }
  | { type: "event-removed"; id: string };

const INITIAL: State = {
  feed: null,
  generation: -1,
  updatedAt: null,
  loadError: null,
  refreshError: null,
  viewerVotes: {},
  pending: {},
  rollback: {},
  likeError: null,
};

/** Copy of `record` without `key`. */
function Without<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  const next = { ...record };
  delete next[key];
  return next;
}

function Reduce(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return INITIAL;

    case "feed-loaded":
      if (action.generation < state.generation) return state;
      return {
        ...state,
        feed: action.feed,
        generation: action.generation,
        updatedAt: action.at,
        loadError: null,
        refreshError: null,
        viewerVotes: { ...state.viewerVotes, ...action.votes },
        pending: SettleVotes(state.pending, action.generation),
      };

    case "feed-failed":
      return state.feed === null ? { ...state, loadError: action.message } : { ...state, refreshError: action.message };

    case "vote-started": {
      const current = state.pending[action.id];
      if (IsVoteInFlight(current)) return state;
      return {
        ...state,
        likeError: null,
        pending: { ...state.pending, [action.id]: StartVote(current, state.viewerVotes[action.id] === true) },
        rollback: { ...state.rollback, [action.id]: current },
      };
    }

    case "vote-confirmed": {
      const current = state.pending[action.id];
      if (current === undefined) return state;
      return {
        ...state,
        viewerVotes: { ...state.viewerVotes, [action.id]: action.voted },
        pending: { ...state.pending, [action.id]: ConfirmVote(current, action.voted, action.nextGeneration) },
        rollback: Without(state.rollback, action.id),
      };
    }

    case "vote-failed": {
      const previous = state.rollback[action.id];
      return {
        ...state,
        likeError: action.message,
        pending: previous === undefined ? Without(state.pending, action.id) : { ...state.pending, [action.id]: previous },
        rollback: Without(state.rollback, action.id),
      };
    }

    case "event-removed":
      return state.feed === null ? state : { ...state, feed: state.feed.filter((event) => event.id !== action.id) };
  }
}

/**
 * The feed of the viewer's organization (see {@link FeedOrgId}), its public
 * tags, and the viewer's likes.
 *
 * **Near-real-time likes.** The API has no push channel, so the feed is
 * fetched again every {@link FEED_REFRESH_MS} while the tab is visible. Polling
 * stops when the tab is hidden (`visibilitychange`) and a fetch runs at once
 * when it becomes visible again. Each answer replaces the vote counts, so other
 * people's likes show up within a few seconds.
 *
 * **The viewer's own likes.** The feed doesn't say whom a vote belongs to, so
 * for a logged-in viewer the vote status of every event is read once with
 * `api.events.voteStatus` (new events as they appear) and kept across refreshes;
 * after a reload it is read again, so hearts always match the server. A click
 * updates the heart and the counter immediately; the vote request then confirms
 * it (the server's answer wins) and triggers a fresh fetch. Until a fetch that
 * started after the confirmation comes back, the click is added on top of the
 * server count (see `domain/likes`). If the request fails, the click is undone
 * and `likeError` says why.
 *
 * Every failure is reported: the first load in `status`, later refreshes in
 * `refreshError` (the last list stays visible), tags in `tagsError`, likes in
 * `likeError`.
 */
export function useEvents() {
  const { state: auth, user } = useAuth();
  const orgId = FeedOrgId(user);
  const viewerId = user === null ? null : user.id;

  const [state, dispatch] = useReducer(Reduce, INITIAL);
  const [tags, setTags] = useState<TagsState>({ kind: "loading" });
  const [loginPromptFor, setLoginPromptFor] = useState<string | null>(null);

  /** Generation of the latest fetch started. */
  const generationRef = useRef(0);
  /** Events whose vote status is known (mirrors `state.viewerVotes`, read inside fetches). */
  const knownVotesRef = useRef(new Set<string>());

  const ready = auth.status === "anonymous" || auth.status === "authenticated";

  const load = useCallback(async () => {
    if (orgId === null) return;
    generationRef.current += 1;
    const generation = generationRef.current;

    const feed = await api.organizations.feed(orgId);
    if (!feed.ok) {
      dispatch({ type: "feed-failed", message: ApiErrorMessage(feed.error) });
      return;
    }

    const votes: Record<string, boolean> = {};
    if (viewerId !== null) {
      const unknown = feed.value.filter((event) => !knownVotesRef.current.has(event.id));
      const answers = await Promise.all(unknown.map((event) => api.events.voteStatus(orgId, event.id)));
      for (const [index, answer] of answers.entries()) {
        if (!answer.ok) {
          dispatch({ type: "feed-failed", message: `Não foi possível saber quais eventos você curtiu. ${ApiErrorMessage(answer.error)}` });
          return;
        }
        votes[unknown[index].id] = answer.value.voted;
      }
      for (const id of Object.keys(votes)) knownVotesRef.current.add(id);
    }

    dispatch({ type: "feed-loaded", generation, feed: feed.value, votes, at: Date.now() });
  }, [orgId, viewerId]);

  useEffect(() => {
    if (!ready || orgId === null) return;
    knownVotesRef.current = new Set();
    dispatch({ type: "reset" });

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer !== null) return;
      void load();
      timer = setInterval(() => void load(), FEED_REFRESH_MS);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, orgId, load]);

  useEffect(() => {
    let active = true;
    api.tags.list().then((answer) => {
      if (!active) return;
      setTags(answer.ok ? { kind: "ready", tags: answer.value } : { kind: "error", message: ApiErrorMessage(answer.error) });
    });
    return () => { active = false; };
  }, []);

  const toggleLike = useCallback(async (eventId: string) => {
    if (viewerId === null || orgId === null) {
      setLoginPromptFor(eventId);
      return;
    }
    setLoginPromptFor(null);
    dispatch({ type: "vote-started", id: eventId });

    const answer = await api.events.vote(orgId, eventId);
    if (!answer.ok) {
      dispatch({ type: "vote-failed", id: eventId, message: `Não foi possível registrar sua curtida. ${ApiErrorMessage(answer.error)}` });
      return;
    }
    dispatch({ type: "vote-confirmed", id: eventId, voted: answer.value.status === "voted", nextGeneration: generationRef.current + 1 });
    void load();
  }, [viewerId, orgId, load]);

  /** Deletes one of the viewer's own events; the error text is for the person. */
  const deleteEvent = useCallback(async (eventId: string): Promise<Result<void, string>> => {
    if (orgId === null) return Err(MISSING_ORG_MESSAGE);
    const answer = await api.events.delete(orgId, eventId);
    if (!answer.ok) return Err(ApiErrorMessage(answer.error));
    dispatch({ type: "event-removed", id: eventId });
    void load();
    return Ok(undefined);
  }, [orgId, load]);

  const catalog = useMemo(() => (tags.kind === "ready" ? tags.tags : []), [tags]);

  const cards: FeedCard[] = useMemo(() => {
    if (state.feed === null) return [];
    return state.feed.map((event) => ToFeedCard(event, catalog, {
      viewerId,
      viewerVoted: state.viewerVotes[event.id] === true,
      pending: state.pending[event.id],
    }));
  }, [state.feed, state.viewerVotes, state.pending, catalog, viewerId]);

  const status: FeedStatus = (() => {
    if (auth.status === "error") return { kind: "error", message: auth.message };
    if (ready && orgId === null) return { kind: "error", message: MISSING_ORG_MESSAGE };
    if (state.loadError !== null && state.feed === null) return { kind: "error", message: state.loadError };
    if (state.feed === null) return { kind: "loading" };
    return { kind: "ready" };
  })();

  return {
    status,
    cards,
    /** When the cards were last fetched (ms since epoch). */
    updatedAt: state.updatedAt,
    refreshError: state.refreshError,
    tagsError: tags.kind === "error" ? tags.message : null,
    likeError: state.likeError,
    /** The event an anonymous visitor tried to like (they are asked to log in). */
    loginPromptFor,
    /** Whether the like request for `eventId` is still running. */
    isLikeInFlight: (eventId: string) => IsVoteInFlight(state.pending[eventId]),
    loggedIn: viewerId !== null,
    toggleLike,
    deleteEvent,
  };
}

/** The public tag catalog. */
type TagsState = { kind: "loading" } | { kind: "ready"; tags: Tag[] } | { kind: "error"; message: string };
