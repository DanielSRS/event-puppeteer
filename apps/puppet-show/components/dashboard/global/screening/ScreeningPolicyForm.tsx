/**
 * The Screening Policy form: for each category, the score (in percent) from
 * which an Image waits in Image Review and the one from which it is rejected
 * outright. Problems show next to each category after the first save attempt.
 *
 * @module
 */

"use client";

import { useState, type FormEvent } from "react";
import { SCREENING_CATEGORIES, type ScreeningCategory, type ScreeningPolicy } from "@/lib/api/schemas";
import { ErrorAlert } from "@/components/ui/Feedback";
import { CATEGORY_LABELS } from "../../images/screeningLabels";
import { PolicyToForm, ValidateScreeningPolicyForm, type ScreeningPolicyFormValues } from "./screeningPolicyForm";

export type ScreeningPolicyFormProps = {
  /** The policy in force; `null` while none was ever set. */
  policy: ScreeningPolicy | null;
  saving: boolean;
  /** Why the last save failed (from the API). */
  error: string;
  onSave: (policy: ScreeningPolicy) => void;
};

/** One number input of a category, in percent. */
function PercentInput({ id, label, value, invalid, describedBy, disabled, onChange }: {
  id: string; label: string; value: string; invalid: boolean; describedBy: string | undefined; disabled: boolean; onChange: (value: string) => void;
}) {
  return (
    <div className="column gap-1">
      <label htmlFor={id} className="text-sm">{label}</label>
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
        className={`input w-28 ${invalid ? "input-error" : ""}`}
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

  const update = (category: ScreeningCategory, field: "lower" | "upper", value: string) =>
    setValues((current) => ({ ...current, [category]: { ...current[category], [field]: value } }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (validation.ok) onSave(validation.value);
  };

  return (
    <form onSubmit={submit} noValidate className="column gap-4" aria-label="Política de triagem">
      <ul className="column gap-3">
        {SCREENING_CATEGORIES.map((category) => {
          const problem = errors[category];
          const errorId = `screening-${category}-error`;
          return (
            <li key={category} className="card column gap-2">
              <h2 className="font-medium">{CATEGORY_LABELS[category]}</h2>
              <div className="flex flex-wrap gap-4">
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
              {problem !== undefined && <p id={errorId} className="error-message">{problem}</p>}
            </li>
          );
        })}
      </ul>
      <ErrorAlert>{error}</ErrorAlert>
      <button type="submit" disabled={saving} className="button self-start min-h-10">{saving ? "Salvando..." : "Salvar política"}</button>
    </form>
  );
}
