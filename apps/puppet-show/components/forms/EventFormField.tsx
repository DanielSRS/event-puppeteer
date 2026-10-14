/**
 * Small pieces shared by the steps of the event editor: how a field is tied to
 * its error message for assistive technology, and the class names every step
 * uses for labels, fields and grouped boxes.
 *
 * @module
 */

import { MdErrorOutline } from "react-icons/md";

/** A label and its control (and message) stacked. */
export const FIELD = "column gap-1.5 min-w-0";

/** A label above a control. */
export const FIELD_LABEL = "mb-0 text-[13px] text-fg-2";

/** A box grouping related controls (a day, the map point), titled by its `<legend>`. */
export const FIELD_BOX = "well column gap-3 min-w-0 rounded-[22px] border px-[18px] pt-4 pb-[18px]";

/** Border of a {@link FIELD_BOX}: the usual line, or red while something in it is wrong. */
export function FieldBoxBorder(invalid: boolean): string {
  return invalid ? "border-danger" : "border-line";
}

/** The `<legend>` of a {@link FIELD_BOX}. */
export const FIELD_BOX_LEGEND = "px-1.5 font-semibold";

/** Short help under a control. */
export const FIELD_HINT = "text-[12.5px] text-fg-3";

/** Id of the element of the field at `path` (e.g. `days.0.date`) inside an editor whose ids start with `prefix`. */
export function FieldId(prefix: string, path: string): string {
  return `${prefix}-${path.replaceAll(".", "-")}`;
}

/**
 * Attributes that mark a control invalid and point it to its message.
 *
 * @param id - Id of the control.
 * @param error - Its error message, if any.
 * @param hint - Id of a hint that always describes the control, if any.
 */
export function FieldA11y(id: string, error: string | undefined, hint?: string) {
  const described = [hint, error ? `${id}-error` : undefined].filter((part) => part !== undefined).join(" ");
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": described === "" ? undefined : described,
  };
}

/** Props of {@link FieldError}. */
type FieldErrorProps = {
  /** Id of the control the message belongs to. */
  fieldId: string;
  /** The message; nothing is rendered without one. */
  error: string | undefined;
};

/** The error message under a control, referenced by its `aria-describedby`. */
export function FieldError({ fieldId, error }: FieldErrorProps) {
  if (!error) return null;
  return (
    <span id={`${fieldId}-error`} className="row items-start gap-1.5 text-[12.5px] text-danger">
      <MdErrorOutline aria-hidden className="mt-px h-4 w-4 shrink-0" />
      {error}
    </span>
  );
}
