/**
 * How API calls become cached queries.
 *
 * A query function here never throws: it resolves to an {@link Answer}, so an
 * error stays a value the screen shows (see `lib/result`). A failed answer
 * carries the last good value the cache had (`last`), so a refresh that fails
 * does not blank a screen that was already showing data, and it counts as
 * stale at once: the next visit asks again instead of showing the failure for
 * the whole {@link Freshness} window.
 *
 * @module
 */

import { queryOptions, type QueryKey } from "@tanstack/react-query";
import type { ApiError, ApiResult } from "@/lib/api/client";

/** How long an answer counts as fresh, in ms: it is shown from the cache and not asked for again. */
export const Freshness = {
  /** Data that other people change all the time (feeds, review queues). */
  live: 0,
  /** Lists the dashboard edits itself; other people's changes show on the next visit. */
  short: 30_000,
  /** Catalogs and branding that rarely change. */
  long: 5 * 60_000,
} as const;

/** How long an unused answer stays in the cache, in ms. */
export const KEEP_MS = 30 * 60_000;

/** What the cache holds for an API read: the value, or the error together with the last good value. */
export type Answer<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError; readonly last: T | null };

/** The value to show (the fresh one, or the last good one after a failure) and the error to tell about, if any. */
export function ReadAnswer<T>(answer: Answer<T> | undefined): { value: T | null; error: ApiError | null } {
  if (answer === undefined) return { value: null, error: null };
  return answer.ok ? { value: answer.value, error: null } : { value: answer.last, error: answer.error };
}

/**
 * Options of a query that reads from the API.
 *
 * @param key - Identifies the answer; include every input the call depends on.
 * @param freshMs - One of {@link Freshness}, for a successful answer.
 */
export function ApiQuery<T>(key: QueryKey, call: () => Promise<ApiResult<T>>, freshMs: number) {
  return queryOptions({
    queryKey: key,
    queryFn: async ({ client }): Promise<Answer<T>> => {
      const result = await call();
      if (result.ok) return result;
      return { ok: false, error: result.error, last: ReadAnswer(client.getQueryData<Answer<T>>(key)).value };
    },
    staleTime: (query) => (query.state.data !== undefined && query.state.data.ok ? freshMs : 0),
    gcTime: KEEP_MS,
  });
}
