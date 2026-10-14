/**
 * A screen's cached list, with a way to change it after an action.
 *
 * @module
 */

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ok, type Result } from "@/lib/result";
import type { LoadedQuery } from "./loaded";

/** What a screen gets from {@link useLoaded}. */
export type Loaded<T> = {
  /** The list or the reason it couldn't load; `null` until the first answer. */
  result: Result<T, string> | null;
  /** Whether a fetch is running (also while `result` is shown from the cache). */
  fetching: boolean;
  /** Applies `change` to the loaded list, as after an action the API accepted; does nothing when there is no list. */
  update: (change: (list: T) => T) => void;
  /** Asks the API again, keeping the current list on screen meanwhile. */
  reload: () => void;
};

/** Reads a cached screen load (see `LoadedQuery`); `enabled: false` holds it back. */
export function useLoaded<T>(options: ReturnType<typeof LoadedQuery<T>>, enabled = true): Loaded<T> {
  const client = useQueryClient();
  const query = useQuery({ ...options, enabled });
  const { queryKey } = options;
  const { refetch } = query;

  const update = useCallback((change: (list: T) => T) => {
    client.setQueryData(queryKey, (current) => (current !== undefined && current.ok ? Ok(change(current.value)) : current));
  }, [client, queryKey]);
  const reload = useCallback(() => { void refetch(); }, [refetch]);

  return { result: query.data === undefined ? null : query.data, fetching: query.isFetching, update, reload };
}
