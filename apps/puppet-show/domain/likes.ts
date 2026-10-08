/**
 * Likes (votes) shown right away and kept consistent with the server.
 *
 * A click changes the heart and the counter immediately (optimistic), while
 * the vote request runs. The counter shown is the server's last count plus the
 * viewer's not-yet-reflected click, so other people's votes arriving with each
 * feed refresh are merged without losing the viewer's own state.
 *
 * A click stays "pending" until a feed fetch that *started after* the vote was
 * confirmed comes back: only that fetch is sure to include the vote in its
 * count. Fetches are numbered (generations) to know which ones qualify.
 *
 * @module
 */

/** A viewer's click the feed counts may not reflect yet. */
export type PendingVote = {
  /** The viewer's vote after the click. */
  voted: boolean;
  /** The viewer's vote as reflected in the server count the screen holds. */
  before: boolean;
  /**
   * Generation of the first feed fetch that is guaranteed to include the vote,
   * or `null` while the vote request is still running.
   */
  settlesAt: number | null;
};

/** Pending clicks by event id. */
export type PendingVotes = Readonly<Record<string, PendingVote>>;

/** What a like button shows. */
export type ShownVote = { voted: boolean; count: number };

/**
 * The heart and counter to show for one event.
 *
 * @param serverCount - Votes in the last feed answer.
 * @param viewerVoted - The viewer's vote as last confirmed by the server.
 * @param pending - The viewer's click not reflected by `serverCount` yet, if any.
 */
export function ShownVoteFor(serverCount: number, viewerVoted: boolean, pending: PendingVote | undefined): ShownVote {
  if (pending === undefined) return { voted: viewerVoted, count: serverCount };
  const delta = (pending.voted ? 1 : 0) - (pending.before ? 1 : 0);
  return { voted: pending.voted, count: Math.max(0, serverCount + delta) };
}

/** Whether the vote request for this click is still running (the button should wait). */
export function IsVoteInFlight(pending: PendingVote | undefined): boolean {
  return pending !== undefined && pending.settlesAt === null;
}

/**
 * The pending entry right after a click: flips what is shown and remembers
 * which vote the held server count reflects.
 */
export function StartVote(current: PendingVote | undefined, viewerVoted: boolean): PendingVote {
  const shown = current === undefined ? viewerVoted : current.voted;
  const before = current === undefined ? viewerVoted : current.before;
  return { voted: !shown, before, settlesAt: null };
}

/**
 * The pending entry once the server answered the vote.
 *
 * @param voted - The server's answer (the source of truth, even if it differs from the click).
 * @param nextGeneration - Generation the next feed fetch will get.
 */
export function ConfirmVote(current: PendingVote, voted: boolean, nextGeneration: number): PendingVote {
  return { voted, before: current.before, settlesAt: nextGeneration };
}

/**
 * Drops the clicks a finished feed fetch already counts.
 *
 * @param generation - Generation of the fetch that just came back.
 */
export function SettleVotes(pending: PendingVotes, generation: number): PendingVotes {
  const next: Record<string, PendingVote> = {};
  for (const [id, vote] of Object.entries(pending)) {
    if (vote.settlesAt !== null && generation >= vote.settlesAt) continue;
    next[id] = vote;
  }
  return next;
}
