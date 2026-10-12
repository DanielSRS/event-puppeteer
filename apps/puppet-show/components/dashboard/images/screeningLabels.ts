/**
 * Portuguese names of the Screening categories and how scores read.
 *
 * @module
 */

import { SCREENING_CATEGORIES, type ScreeningCategory, type ScreeningScores } from "@/lib/api/schemas";

/** What each Screening category looks for. */
export const CATEGORY_LABELS: Record<ScreeningCategory, string> = {
  nudity: "Nudez",
  gore: "Sangue e ferimentos",
  violence: "Violência",
  weapons: "Armas",
  hate: "Símbolos de ódio e extremismo",
  offensive_gesture: "Gestos ofensivos",
  offensive_text: "Texto ofensivo",
};

/** A score as a whole percentage, e.g. 0.456 → "46%". */
export function Percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** The categories with a score of at least 1%, most suspected first. */
export function SuspectedCategories(scores: ScreeningScores): Array<{ category: ScreeningCategory; score: number }> {
  return SCREENING_CATEGORIES
    .flatMap((category) => {
      const score = scores[category];
      return score === undefined || score < 0.01 ? [] : [{ category, score }];
    })
    .sort((a, b) => b.score - a.score);
}
