/**
 * Timing of the TV display (kiosk): the feed is shown in windows of
 * {@link TV_WINDOW_SIZE} events that rotate by themselves.
 *
 * Each window stays on screen {@link BASE_WINDOW_MS} plus
 * {@link MS_PER_VOTE} for every vote its events have, so popular events are
 * seen for longer. With {@link TV_WINDOW_SIZE} events or fewer there is a
 * single window and nothing rotates (no event is ever shown twice).
 *
 * @module
 */

/** Events per window. */
export const TV_WINDOW_SIZE = 3;

/** Minimum time a window stays on screen. */
export const BASE_WINDOW_MS = 15_000;

/** Extra time per vote of the events in the window. */
export const MS_PER_VOTE = 1_000;

/** How often the display asks for a fresh feed. */
export const TV_REFRESH_MS = 30_000;

/** Splits the feed into consecutive windows of `size` events (the last may be shorter). */
export function TvWindows<T>(events: readonly T[], size: number = TV_WINDOW_SIZE): T[][] {
  const windows: T[][] = [];
  for (let start = 0; start < events.length; start += size) windows.push(events.slice(start, start + size));
  return windows;
}

/** How long a window stays on screen: `15 s + 1 s × votes in the window`. */
export function WindowDurationMs(window: ReadonlyArray<{ voteCount: number }>): number {
  const votes = window.reduce((sum, event) => sum + event.voteCount, 0);
  return BASE_WINDOW_MS + votes * MS_PER_VOTE;
}

/**
 * The window to show after `current`, wrapping around. A refresh may shrink
 * the feed, so an index past the end restarts at the first window.
 */
export function NextWindowIndex(current: number, windowCount: number): number {
  if (windowCount <= 1) return 0;
  return current + 1 >= windowCount ? 0 : current + 1;
}

/** `current` when it still exists after a refresh, otherwise the first window. */
export function ValidWindowIndex(current: number, windowCount: number): number {
  return current < windowCount ? current : 0;
}
