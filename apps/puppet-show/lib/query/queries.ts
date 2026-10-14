/**
 * Every read the screens make, as a cached query.
 *
 * The same function builds the options for `useQuery` and for prefetching
 * (`lib/query/prefetch`), so a screen and the hover that warms it always agree
 * on the key and on how long the answer stays fresh.
 *
 * @module
 */

import { queryOptions } from "@tanstack/react-query";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { GetToken, SetToken, STORAGE_UNAVAILABLE_MESSAGE } from "@/lib/api/session";
import type { FeedEvent, User } from "@/lib/api/schemas";
import { Ok } from "@/lib/result";
import { ApiQuery, Freshness, KEEP_MS } from "./options";

/** Where the session stands. */
export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User }
  /** The session couldn't be read; `message` says why, for the person. */
  | { status: "error"; message: string };

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

/** The session, asked once and shared by every screen. */
export const sessionQuery = () => queryOptions({
  queryKey: ["session"],
  queryFn: LoadSession,
  staleTime: (query) => (query.state.data !== undefined && query.state.data.status === "error" ? 0 : Freshness.long),
  gcTime: KEEP_MS,
});

/** The public tag catalog. */
export const tagsQuery = () => ApiQuery(["tags"], () => api.tags.list(), Freshness.long);

/** The public link-label catalog. */
export const linkLabelsQuery = () => ApiQuery(["link-labels"], () => api.linkLabels.list(), Freshness.long);

/** One organization (name, logo, report threshold). */
export const organizationQuery = (orgId: string) =>
  ApiQuery(["organization", orgId], () => api.organizations.get(orgId), Freshness.long);

/** Every organization (Superadmin). */
export const organizationsQuery = () => ApiQuery(["organizations"], () => api.organizations.list(), Freshness.short);

/** A feed answer and the number of the fetch that produced it (see `domain/likes`). */
export type NumberedFeed = { generation: number; feed: FeedEvent[] };

/** Number of the latest feed fetch started. */
let feedGeneration = 0;

/** Number the next feed fetch will get. */
export function NextFeedGeneration(): number {
  return feedGeneration + 1;
}

/**
 * The public feed of an organization. It is always asked again when a screen
 * shows it; the cache only fills the screen while that happens. Fetches are
 * numbered in the order they start, to know which ones count a given like.
 */
export const feedQuery = (orgId: string) => ApiQuery<NumberedFeed>(["feed", orgId], async () => {
  feedGeneration += 1;
  const generation = feedGeneration;
  const feed = await api.organizations.feed(orgId);
  return feed.ok ? Ok({ generation, feed: feed.value }) : feed;
}, Freshness.live);

/** Whether the logged-in person liked an event. */
export const voteStatusQuery = (orgId: string, eventId: string) =>
  ApiQuery(["vote-status", orgId, eventId], () => api.events.voteStatus(orgId, eventId), Freshness.long);

/** Whether the logged-in person reported an event. */
export const reportStatusQuery = (orgId: string, eventId: string) =>
  ApiQuery(["report-status", orgId, eventId], () => api.events.reportStatus(orgId, eventId), Freshness.short);

/** One event with its vote count; asked again at each visit, since the count moves. */
export const eventQuery = (orgId: string, eventId: string) =>
  ApiQuery(["event", orgId, eventId], () => api.events.get(orgId, eventId), Freshness.live);

/** Key of the dashboard's "Meus Eventos" list, for screens that change what it shows. */
export const ownEventsKey = (orgId: string) => ["dashboard", "own-events", orgId] as const;
