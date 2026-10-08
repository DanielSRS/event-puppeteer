/**
 * Errors as values.
 *
 * Code in this app never throws to signal an expected failure: functions that
 * can fail return a {@link Result}, and the caller must look at `ok` before it
 * can reach the value. Throwing boundaries (fetch, JSON, browser storage) are
 * wrapped once and turned into a `Result` where they are called.
 *
 * @module
 */

/** The value a successful operation produced. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** Why an operation failed. */
export type Err<E> = { readonly ok: false; readonly error: E };

/** Either the value of a successful operation or the reason it failed. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Builds a successful {@link Result}. */
export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Builds a failed {@link Result}. */
export function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}
