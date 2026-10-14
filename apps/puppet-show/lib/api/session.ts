/**
 * Where the browser keeps the Puppeteer session token, and which organization
 * anonymous visitors see.
 *
 * Puppeteer answers login with a bearer token; it is kept in `localStorage` and
 * sent on every API call. Storage can be blocked (private mode, site data
 * disabled): that is reported as a value so the UI can tell the person why the
 * session doesn't stick, instead of silently behaving as logged out.
 *
 * @module
 */

import { Err, Ok, type Result } from "@/lib/result";

const TOKEN_KEY = "puppet-show:token";

/** Window event that tells the app the session changed (login, logout). */
export const AUTH_EVENT = "auth-change";

/** The browser refused access to `localStorage`. */
export type StorageUnavailable = { kind: "storage-unavailable" };

/** Reads the saved session token; `null` when nobody is logged in. */
export function GetToken(): Result<string | null, StorageUnavailable> {
  try {
    return Ok(window.localStorage.getItem(TOKEN_KEY));
  } catch {
    return Err({ kind: "storage-unavailable" });
  }
}

/** Saves the session token, or clears it when `token` is `null`. */
export function SetToken(token: string | null): Result<void, StorageUnavailable> {
  try {
    if (token === null) window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, token);
    return Ok(undefined);
  } catch {
    return Err({ kind: "storage-unavailable" });
  }
}

/** Shown when the browser blocks the storage the session lives in. */
export const STORAGE_UNAVAILABLE_MESSAGE =
  "O navegador bloqueou o armazenamento local, então não é possível manter você conectado. Permita dados de site para este endereço e tente de novo.";

/**
 * The organization anonymous visitors see (feed, TV display) and that sign-ups
 * join. There is deliberately no default: the database starts without
 * organizations, so a missing value has to show up as {@link MISSING_ORG_MESSAGE}.
 */
export const PUBLIC_ORG_ID: string | null = process.env.NEXT_PUBLIC_ORG_ID || null;

/** Shown wherever {@link PUBLIC_ORG_ID} is needed but not configured. */
export const MISSING_ORG_MESSAGE =
  "Organização não configurada. Defina NEXT_PUBLIC_ORG_ID com o id de uma organização existente.";
