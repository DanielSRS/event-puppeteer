/**
 * Loading data before it is asked for.
 *
 * A warm-up fetches a query into the cache when the person shows intent
 * (hovering, focusing or touching a link), so the page they are about to open
 * finds its data already there. It uses the same options as the page, so a
 * warm-up and the page agree on the key and on how long the answer stays fresh:
 * an answer still fresh is not fetched again.
 *
 * A warm-up is best effort: nothing waits for it, and when it fails the page
 * asks again and shows the error itself.
 *
 * @module
 */

import type { QueryClient } from "@tanstack/react-query";
import type { LoadedQuery } from "./loaded";
import type { ApiQuery } from "./options";

/** Something that fills the cache when run. */
export type Warmup = (client: QueryClient) => void;

/** Nothing to do with the outcome of a warm-up. */
const IGNORED = () => undefined;

/** Warms an API read (see `lib/query/queries`). */
export function WarmApi<T>(options: ReturnType<typeof ApiQuery<T>>): Warmup {
  return (client) => { void client.query(options).then(IGNORED, IGNORED); };
}

/** Warms a screen's cached load (see `lib/query/loaded`). */
export function WarmLoaded<T>(options: ReturnType<typeof LoadedQuery<T>>): Warmup {
  return (client) => { void client.query(options).then(IGNORED, IGNORED); };
}
