import type { ImageScreener, ScreeningFailure } from '../index.ts';
import type { ScreeningScores } from '../../types/image.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Test double: answers with whatever the test set, and records what it was asked to screen.
 * Starts with every score at 0 (a clean Image) so tests that don't care about Screening
 * need no setup. Never wired in production.
 */
export class InMemoryImageScreener implements ImageScreener {
  /** The scores the next screenings answer with. */
  scores: ScreeningScores = { nudity: 0, gore: 0, violence: 0, weapons: 0, hate: 0, offensive_gesture: 0, offensive_text: 0 };
  /** When set, screenings fail with it instead of answering `scores`. */
  failure: ScreeningFailure | null = null;
  /** The bytes of every Image screened, in order. */
  screened: Uint8Array<ArrayBuffer>[] = [];

  async screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>> {
    this.screened.push(webp);
    return this.failure !== null ? err(this.failure) : ok(this.scores);
  }
}
