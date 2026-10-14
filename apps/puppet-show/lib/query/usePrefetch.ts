/**
 * Runs warm-ups (see `lib/query/warm`) from event handlers.
 *
 * @module
 */

"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Warmup } from "./warm";

/** A function that runs the given warm-ups against the shared cache. */
export function usePrefetch(): (...warmups: Warmup[]) => void {
  const client = useQueryClient();
  return useCallback((...warmups) => { for (const warmup of warmups) warmup(client); }, [client]);
}
