/**
 * Reading from the API through the shared cache, as the screens see it.
 *
 * @module
 */

"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/lib/api/client";
import { ReadAnswer, type ApiQuery } from "./options";

/** What a screen knows about one API read. */
export type ApiData<T> = {
  /** The answer, or the last good one when the latest fetch failed; `null` until there is one. */
  value: T | null;
  /** Why the latest fetch failed (`value` may still hold older data); `null` when it did not. */
  error: ApiError | null;
  /** No answer yet, not even a failed one. */
  loading: boolean;
  /** Whether a fetch is running now (also while `value` is shown from the cache). */
  fetching: boolean;
  /** When `value` was fetched (ms since epoch); `null` while there is none. */
  updatedAt: number | null;
  /** Asks the API again. */
  refetch: () => void;
};

/** What a screen may add to a query's options. */
export type ApiQueryExtras = {
  /** `false` holds the query back (e.g. while the organization isn't known yet). */
  enabled?: boolean;
  /** Fetch again every this many ms while the tab is visible. */
  refetchInterval?: number;
  /** Fetch again when the tab becomes visible. */
  refetchOnWindowFocus?: boolean;
};

/** Runs an API read through the cache; build `options` with the functions in `lib/query/queries`. */
export function useApiQuery<T>(options: ReturnType<typeof ApiQuery<T>>, extras: ApiQueryExtras = {}): ApiData<T> {
  const query = useQuery({ ...options, ...extras });
  const { value, error } = ReadAnswer(query.data);
  const { refetch } = query;
  const again = useCallback(() => { void refetch(); }, [refetch]);

  return {
    value,
    error,
    loading: query.data === undefined && extras.enabled !== false,
    fetching: query.isFetching,
    updatedAt: value === null ? null : query.dataUpdatedAt,
    refetch: again,
  };
}
