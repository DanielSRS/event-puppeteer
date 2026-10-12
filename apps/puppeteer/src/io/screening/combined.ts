import type { ImageScreener, ScreeningFailure } from '../index.ts';
import type { ScreeningCategory, ScreeningScores } from '../../types/image.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Screens with several engines at once and keeps, for every category, the most severe
 * score any of them gave: one engine's miss is caught by another. If any engine fails,
 * Screening cannot conclude, since part of the analysis is missing.
 */
export class CombinedImageScreener implements ImageScreener {
  constructor(private engines: ImageScreener[]) {}

  async screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>> {
    const results = await Promise.all(this.engines.map(engine => engine.screen(webp)));
    const scores: ScreeningScores = {};
    const failures: ScreeningFailure[] = [];
    for (const result of results) {
      if (!result.ok) {
        failures.push(result.error);
        continue;
      }
      for (const [category, score] of Object.entries(result.value) as [ScreeningCategory, number][]) {
        scores[category] = Math.max(scores[category] ?? 0, score);
      }
    }
    return failures.length > 0 ? err(failures.join('; ')) : ok(scores);
  }
}
