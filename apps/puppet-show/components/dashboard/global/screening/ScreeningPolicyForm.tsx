/**
 * The Screening Policy form: one glass card with a row per category. Each row
 * has the category name, a bar showing the Approved / In Review / Rejected
 * ranges for the typed cut-offs, and the two inputs in percent: the score
 * from which an Image waits in Image Review and the one from which it is
 * rejected outright. Problems show under each category after the first save
 * attempt, and the footer counts them next to the save button.
 *
 * @module
 */

"use client";

import { useState, type FormEvent } from "react";
import { MdErrorOutline } from "react-icons/md";
import { SCREENING_CATEGORIES, type ScreeningCategory, type ScreeningPolicy } from "@/lib/api/schemas";
import { ErrorAlert } from "@/components/ui/Feedback";
import { CATEGORY_LABELS } from "../../images/screeningLabels";
import { PolicyToForm, ValidateScreeningPolicyForm, type CutOffsForm, type ScreeningPolicyFormValues } from "./screening-policy-form-values";

export type ScreeningPolicyFormProps = {
  /** The policy in force; `null` while none was ever set. */
  policy: ScreeningPolicy | null;
  saving: boolean;
  /** Why the last save failed (from the API). */
  error: string;
  onSave: (policy: ScreeningPolicy) => void;
};

/** A typed whole percentage from 0 to 100, or `null` (only to draw the bar). */
function BarPercent(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 100 ? value : null;
}

/** Approved / In Review / Rejected ranges of a category; neutral while a cut-off is missing. */
function RangeBar({ cutOffs }: { cutOffs: CutOffsForm }) {
  const lower = BarPercent(cutOffs.lower);
  const upper = BarPercent(cutOffs.upper);
  const frame = "flex h-2.5 min-w-0 flex-[2_1_220px] gap-0.5 overflow-hidden rounded-full";
  if (lower === null || upper === null) return <span aria-hidden className={`${frame} bg-[var(--surface-2)]`} />;
  const review = Math.min(lower, upper);
  return (
    <span aria-hidden className={frame}>
      <span className="shrink-0 bg-[var(--ok)]" style={{ width: `${review}%` }} />
      <span className="shrink-0 bg-[var(--warn)]" style={{ width: `${Math.max(0, upper - review)}%` }} />
      <span className="min-w-0 flex-1 bg-[var(--bad)]" />
    </span>
  );
}

/** One number input of a category, in percent. */
function PercentInput({ id, label, value, invalid, describedBy, disabled, onChange }: {
  id: string; label: string; value: string; invalid: boolean; describedBy: string | undefined; disabled: boolean; onChange: (value: string) => void;
}) {
  return (
    <div className="column min-w-0 flex-1 gap-1">
      <label htmlFor={id} className="caption">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`input mono min-h-11 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${invalid ? "input-error" : ""}`}
      />
    </div>
  );
}

/** Cut-offs of every category. */
export function ScreeningPolicyForm({ policy, saving, error, onSave }: ScreeningPolicyFormProps) {
  const [values, setValues] = useState<ScreeningPolicyFormValues>(PolicyToForm(policy));
  const [submitted, setSubmitted] = useState(false);
  const validation = ValidateScreeningPolicyForm(values);
  const errors = submitted && !validation.ok ? validation.error : {};
  const problems = Object.keys(errors).length;

  const update = (category: ScreeningCategory, field: "lower" | "upper", value: string) =>
    setValues((current) => ({ ...current, [category]: { ...current[category], [field]: value } }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (validation.ok) onSave(validation.value);
  };

  return (
    <form onSubmit={submit} noValidate className="glass overflow-hidden rounded-[26px]" aria-label="Política de triagem">
      <ul>
        {SCREENING_CATEGORIES.map((category) => {
          const problem = errors[category];
          const errorId = `screening-${category}-error`;
          return (
            <li key={category} className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-[color:var(--line)] px-5 py-4 first:border-t-0">
              <h2 className="min-w-0 flex-[1_1_200px] font-semibold break-words">{CATEGORY_LABELS[category]}</h2>
              <RangeBar cutOffs={values[category]} />
              <div className="flex min-w-0 flex-[0_1_260px] gap-2.5 max-sm:flex-[1_1_100%]">
                <PercentInput
                  id={`screening-${category}-lower`}
                  label="Revisar a partir de (%)"
                  value={values[category].lower}
                  invalid={problem !== undefined}
                  describedBy={problem !== undefined ? errorId : undefined}
                  disabled={saving}
                  onChange={(value) => update(category, "lower", value)}
                />
                <PercentInput
                  id={`screening-${category}-upper`}
                  label="Recusar a partir de (%)"
                  value={values[category].upper}
                  invalid={problem !== undefined}
                  describedBy={problem !== undefined ? errorId : undefined}
                  disabled={saving}
                  onChange={(value) => update(category, "upper", value)}
                />
              </div>
              {problem !== undefined && (
                <p className="error-message flex basis-full items-center gap-2 text-[13px]">
                  <MdErrorOutline aria-hidden className="h-[15px] w-[15px] shrink-0" />
                  <span id={errorId}>{problem}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="well flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-5 py-4">
        <ErrorAlert className="basis-full">{error}</ErrorAlert>
        <span className="error-message text-[13px]">
          {problems === 0 ? "" : `Corrija ${problems} ${problems === 1 ? "categoria" : "categorias"} antes de salvar.`}
        </span>
        <button type="submit" disabled={saving} className="button main min-h-12 px-[22px] max-sm:w-full">{saving ? "Salvando..." : "Salvar política"}</button>
      </div>
    </form>
  );
}
