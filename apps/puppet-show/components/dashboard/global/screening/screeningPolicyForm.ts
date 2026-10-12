/**
 * Rules of the Screening Policy form.
 *
 * People type cut-offs as whole percentages (0 to 100); the API takes them as
 * fractions (0 to 1). For each category, scores below the review cut-off are
 * Approved, from the rejection cut-off on Rejected, in between In Review, so
 * the review cut-off can't be above the rejection one.
 *
 * @module
 */

import { SCREENING_CATEGORIES, type ScreeningCategory, type ScreeningPolicy } from "@/lib/api/schemas";
import { Err, Ok, type Result } from "@/lib/result";

/** The two cut-offs of a category as typed, in percent. */
export type CutOffsForm = { lower: string; upper: string };

/** Every category's cut-offs as typed. */
export type ScreeningPolicyFormValues = Record<ScreeningCategory, CutOffsForm>;

/** What is wrong with each category's cut-offs. */
export type ScreeningPolicyFormErrors = Partial<Record<ScreeningCategory, string>>;

/** A fraction as a whole percentage text, e.g. 0.3 → "30". */
function ToPercent(fraction: number): string {
  return String(Math.round(fraction * 100));
}

/** The form filled with `policy`, or empty while there is none. */
export function PolicyToForm(policy: ScreeningPolicy | null): ScreeningPolicyFormValues {
  return Object.fromEntries(SCREENING_CATEGORIES.map((category) => [
    category,
    policy === null ? { lower: "", upper: "" } : { lower: ToPercent(policy[category].lower), upper: ToPercent(policy[category].upper) },
  ])) as ScreeningPolicyFormValues;
}

/** A typed whole percentage from 0 to 100, or `null`. */
function ParsePercent(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 100 ? value : null;
}

/** Checks every category and builds the policy the API takes. */
export function ValidateScreeningPolicyForm(values: ScreeningPolicyFormValues): Result<ScreeningPolicy, ScreeningPolicyFormErrors> {
  const errors: ScreeningPolicyFormErrors = {};
  const entries: Array<[ScreeningCategory, { lower: number; upper: number }]> = [];

  for (const category of SCREENING_CATEGORIES) {
    const lower = ParsePercent(values[category].lower);
    const upper = ParsePercent(values[category].upper);
    if (lower === null || upper === null) errors[category] = "Informe os dois limites como números inteiros de 0 a 100.";
    else if (lower > upper) errors[category] = "O limite de revisão não pode passar o de recusa.";
    else entries.push([category, { lower: lower / 100, upper: upper / 100 }]);
  }

  if (Object.keys(errors).length > 0) return Err(errors);
  return Ok(Object.fromEntries(entries) as ScreeningPolicy);
}
