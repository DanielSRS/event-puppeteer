/**
 * Cached reads for screens that turn the API's answers into their own lists
 * and say in Portuguese why a load failed.
 *
 * The screen's loader resolves to `Result<T, string>`: the list ready to show,
 * or the message to show instead. The cache keeps that value, so the list
 * comes back at once when the person returns to the screen, and a failed load
 * counts as stale at once (see {@link Freshness}).
 *
 * @module
 */

import { queryOptions, type QueryKey } from "@tanstack/react-query";
import type { Result } from "@/lib/result";
import { KEEP_MS } from "./options";

/**
 * Options of a cached screen load.
 *
 * @param key - Identifies the list; include every input the loader depends on.
 * @param load - The screen's loader; it never throws.
 * @param freshMs - One of {@link Freshness}, for a load that worked.
 */
export function LoadedQuery<T>(key: QueryKey, load: () => Promise<Result<T, string>>, freshMs: number) {
  return queryOptions({
    queryKey: key,
    queryFn: load,
    staleTime: (query) => (query.state.data !== undefined && query.state.data.ok ? freshMs : 0),
    gcTime: KEEP_MS,
  });
}
