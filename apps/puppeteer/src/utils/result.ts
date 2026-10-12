/**
 * The outcome of an operation that can fail, carried as a value instead of thrown.
 * `E` describes the failure; callers must check `ok` before reading `value`.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** A successful Result carrying `value`. */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

/** A failed Result carrying `error`. */
export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
