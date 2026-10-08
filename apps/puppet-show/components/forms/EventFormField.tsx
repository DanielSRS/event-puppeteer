/**
 * Small pieces shared by the steps of the event editor: how a field is tied to
 * its error message for assistive technology.
 *
 * @module
 */

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
  return <span id={`${fieldId}-error`} className="error-message mt-1">{error}</span>;
}
