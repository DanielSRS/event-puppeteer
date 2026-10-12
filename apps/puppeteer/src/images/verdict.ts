import { SCREENING_CATEGORIES, type ImageState, type ScreeningPolicy, type ScreeningScores } from '../types/image.ts';

/**
 * Screening's verdict for a set of scores under a Screening Policy: Rejected when any score
 * reaches its category's upper cut-off, In Review when any reaches its lower cut-off,
 * Approved otherwise. Categories without a score are not measured and weigh nothing.
 */
export function verdictFor(scores: ScreeningScores, policy: ScreeningPolicy): ImageState {
  let verdict: ImageState = 'approved';
  for (const category of SCREENING_CATEGORIES) {
    const score = scores[category];
    if (score === undefined) continue;
    if (score >= policy[category].upper) return 'rejected';
    if (score >= policy[category].lower) verdict = 'in_review';
  }
  return verdict;
}
