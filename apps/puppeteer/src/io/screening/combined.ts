import type { ImageScreener, ScreeningFailure } from '../index.ts';
import type { ScreeningCategory, ScreeningScores } from '../../types/image.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Screens with several engines at once and keeps, for every category, the most severe
 * score any of them gave: one engine's miss is caught by another. If any engine fails,
 * Screening cannot conclude, since part of the analysis is missing; the failure then
 * carries every engine's reason and the scores of those that answered.
 */
export class CombinedImageScreener implements ImageScreener {
  constructor(private engines: ImageScreener[]) {}

  async screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>> {
    const results = await Promise.all(this.engines.map(engine => engine.screen(webp)));
    const scores: ScreeningScores = {};
    const reasons: string[] = [];
    for (const result of results) {
      const answered = result.ok ? result.value : result.error.partialScores;
      if (!result.ok) reasons.push(result.error.reason);
      for (const [category, score] of Object.entries(answered) as [ScreeningCategory, number][]) {
        const current = scores[category];
        scores[category] = current === undefined ? score : Math.max(current, score);
      }
    }
    return reasons.length > 0 ? err({ reason: reasons.join('; '), partialScores: scores }) : ok(scores);
  }
}
