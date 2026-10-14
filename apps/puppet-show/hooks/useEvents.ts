/**
 * The public feed with live-ish like counters, for the home page.
 *
 * @module
 */

"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "@/lib/api/session";
import { UserOrgId, type User } from "@/lib/api/schemas";
import { ToFeedCard } from "@/lib/api/mappers";
import type { FeedCard } from "@/domain/feed";
import { ConfirmVote, IsVoteInFlight, SettleVotes, StartVote, type PendingVote, type PendingVotes } from "@/domain/likes";
import { feedQuery, NextFeedGeneration, ownEventsKey, tagsQuery, voteStatusQuery } from "@/lib/query/queries";
import { ReadAnswer } from "@/lib/query/options";
import { useApiQuery } from "@/lib/query/useApiQuery";
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

/** The clicks the feed counts may not reflect yet; the likes themselves live in the query cache. */
type State = {
  pending: PendingVotes;
  /** Pending entry before the click in flight, to restore it if the vote fails. */
  rollback: Readonly<Record<string, PendingVote | undefined>>;
  /** Why the last like failed. */
  likeError: string | null;
};

type Action =
  | { type: "vote-started"; id: string; viewerVoted: boolean }
  | { type: "vote-confirmed"; id: string; voted: boolean; nextGeneration: number }
  | { type: "vote-failed"; id: string; message: string }
  | { type: "feed-settled"; generation: number };

const INITIAL: State = { pending: {}, rollback: {}, likeError: null };

/** Copy of `record` without `key`. */
function Without<V>(record: Readonly<Record<string, V>>, key: string): Record<string, V> {
  const next = { ...record };
  delete next[key];
  return next;
}

function Reduce(state: State, action: Action): State {
  switch (action.type) {
    case "feed-settled":
      return { ...state, pending: SettleVotes(state.pending, action.generation) };

    case "vote-started": {
      const current = state.pending[action.id];
      if (IsVoteInFlight(current)) return state;
      return {
        ...state,
        likeError: null,
        pending: { ...state.pending, [action.id]: StartVote(current, action.viewerVoted) },
        rollback: { ...state.rollback, [action.id]: current },
      };
    }

    case "vote-confirmed": {
      const current = state.pending[action.id];
      if (current === undefined) return state;
      return {
        ...state,
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
  }
}

/**
 * The feed of the viewer's organization (see {@link FeedOrgId}), its public
 * tags, and the viewer's likes.
 *
 * **Cache.** Everything is read through the shared query cache
 * (`lib/query/queries`), so coming back to the home page shows the last feed
 * at once while a fresh one is fetched.
 *
 * **Near-real-time likes.** The API has no push channel, so the feed is
 * fetched again every {@link FEED_REFRESH_MS} while the tab is visible. Polling
 * pauses when the tab is hidden and a fetch runs at once when it becomes
 * visible again. Each answer replaces the vote counts, so other people's likes
 * show up within a few seconds.
 *
 * **The viewer's own likes.** The feed doesn't say whom a vote belongs to, so
 * for a logged-in viewer the vote status of every event is read with
 * `api.events.voteStatus` (once per event, kept in the cache) and an event
 * appears once its status is known, so hearts always match the server. A click
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
  const client = useQueryClient();
  const { state: auth, user } = useAuth();
  const orgId = FeedOrgId(user);
  const viewerId = user === null ? null : user.id;
  const viewerIsSuperadmin = user !== null && user.role === "Superadmin";

  const [state, dispatch] = useReducer(Reduce, INITIAL);
  const [loginPromptFor, setLoginPromptFor] = useState<string | null>(null);

  const ready = auth.status === "anonymous" || auth.status === "authenticated";
  const enabled = ready && orgId !== null;

  const feed = useApiQuery(feedQuery(orgId === null ? "" : orgId), {
    enabled,
    refetchInterval: FEED_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const tags = useApiQuery(tagsQuery());

  const answer = feed.value;
  const events = useMemo(() => (answer === null ? [] : answer.feed), [answer]);

  const votes = useQueries({
    queries: events.map((event) => ({
      ...voteStatusQuery(orgId === null ? "" : orgId, event.id),
      enabled: enabled && viewerId !== null,
    })),
  });

  const generation = answer === null ? null : answer.generation;
  useEffect(() => {
    if (generation !== null) dispatch({ type: "feed-settled", generation });
  }, [generation]);

  const viewerVotes = useMemo(() => {
    const known: Record<string, boolean> = {};
    for (const [index, vote] of votes.entries()) {
      const { value } = ReadAnswer(vote.data);
      if (value !== null) known[events[index].id] = value.voted;
    }
    return known;
  }, [votes, events]);

  const voteFailure = useMemo(() => {
    for (const vote of votes) {
      const { error } = ReadAnswer(vote.data);
      if (error !== null) return error;
    }
    return null;
  }, [votes]);
  const voteError = voteFailure === null
    ? null
    : `Não foi possível saber quais eventos você curtiu. ${ApiErrorMessage(voteFailure)}`;

  const shown = useMemo(
    () => (viewerId === null ? events : events.filter((event) => viewerVotes[event.id] !== undefined)),
    [events, viewerId, viewerVotes],
  );

  const toggleLike = async (eventId: string) => {
    if (viewerId === null || orgId === null) {
      setLoginPromptFor(eventId);
      return;
    }
    setLoginPromptFor(null);
    dispatch({ type: "vote-started", id: eventId, viewerVoted: viewerVotes[eventId] === true });

    const voted = await api.events.vote(orgId, eventId);
    if (!voted.ok) {
      dispatch({ type: "vote-failed", id: eventId, message: `Não foi possível registrar sua curtida. ${ApiErrorMessage(voted.error)}` });
      return;
    }
    const confirmed = voted.value.status === "voted";
    client.setQueryData(voteStatusQuery(orgId, eventId).queryKey, Ok({ voted: confirmed }));
    dispatch({ type: "vote-confirmed", id: eventId, voted: confirmed, nextGeneration: NextFeedGeneration() });
    void client.invalidateQueries({ queryKey: feedQuery(orgId).queryKey });
  };

  /** Deletes an event the viewer may delete (their own, or any as Superadmin); the error text is for the person. */
  const deleteEvent = async (eventId: string): Promise<Result<void, string>> => {
    if (orgId === null) return Err(MISSING_ORG_MESSAGE);
    const removed = await api.events.delete(orgId, eventId);
    if (!removed.ok) return Err(ApiErrorMessage(removed.error));
    client.setQueryData(feedQuery(orgId).queryKey, (current) => {
      if (current === undefined || !current.ok) return current;
      return Ok({ ...current.value, feed: current.value.feed.filter((event) => event.id !== eventId) });
    });
    void client.invalidateQueries({ queryKey: feedQuery(orgId).queryKey });
    void client.invalidateQueries({ queryKey: ownEventsKey(orgId) });
    return Ok(undefined);
  };

  const catalog = useMemo(() => (tags.value === null ? [] : tags.value), [tags.value]);

  const cards: FeedCard[] = useMemo(() => shown.map((event) => ToFeedCard(event, catalog, {
    viewerId,
    viewerIsSuperadmin,
    viewerVoted: viewerVotes[event.id] === true,
    pending: state.pending[event.id],
  })), [shown, viewerVotes, state.pending, catalog, viewerId, viewerIsSuperadmin]);

  const feedError = feed.error === null ? null : ApiErrorMessage(feed.error);
  const votesPending = viewerId !== null && votes.some((vote) => vote.data === undefined);

  const status: FeedStatus = (() => {
    if (auth.status === "error") return { kind: "error", message: auth.message };
    if (ready && orgId === null) return { kind: "error", message: MISSING_ORG_MESSAGE };
    if (answer === null) return feedError !== null ? { kind: "error", message: feedError } : { kind: "loading" };
    if (shown.length === 0 && votesPending) return { kind: "loading" };
    return { kind: "ready" };
  })();

  const refreshError = answer === null ? null : (feedError !== null ? feedError : voteError);
  const tagsFailure = tags.error === null ? null : ApiErrorMessage(tags.error);

  return {
    status,
    cards,
    /** When the cards were last fetched (ms since epoch). */
    updatedAt: feed.updatedAt,
    refreshError,
    tagsError: tagsFailure,
    likeError: state.likeError,
    /** The event an anonymous visitor tried to like (they are asked to log in). */
    loginPromptFor,
    /** Whether the like request for `eventId` is still running. */
    isLikeInFlight: (eventId: string) => IsVoteInFlight(state.pending[eventId]),
    loggedIn: viewerId !== null,
    /** Organization whose feed this is; `null` while unknown or not configured. */
    orgId,
    toggleLike,
    deleteEvent,
  };
}
