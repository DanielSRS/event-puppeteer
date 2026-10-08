/**
 * Remembers which context a Superadmin was managing (an organization or the
 * global context), so a reload brings them back to it.
 *
 * Kept in `localStorage` per user. The browser may refuse storage; that comes
 * back as a value so the dashboard can tell the person their choice won't be
 * remembered.
 *
 * @module
 */

import { Err, Ok, type Result } from "@/lib/result";
import type { StorageUnavailable } from "@/lib/api/session";

/** Stored instead of an organization id for the global context. */
const GLOBAL = "global";

/** Storage key for `userId`'s choice. */
function Key(userId: string): string {
  return `puppet-show:dashboard-context:${userId}`;
}

/** What was stored: nothing yet, the global context, or an organization id. */
export type StoredContext = { kind: "none" } | { kind: "global" } | { kind: "org"; orgId: string };

/** Reads the context `userId` chose last time. */
export function ReadStoredContext(userId: string): Result<StoredContext, StorageUnavailable> {
  try {
    const raw = window.localStorage.getItem(Key(userId));
    if (raw === null) return Ok({ kind: "none" });
    if (raw === GLOBAL) return Ok({ kind: "global" });
    return Ok({ kind: "org", orgId: raw });
  } catch {
    return Err({ kind: "storage-unavailable" });
  }
}

/** Saves the context `userId` just picked (`null` = global). */
export function StoreContext(userId: string, orgId: string | null): Result<void, StorageUnavailable> {
  try {
    window.localStorage.setItem(Key(userId), orgId === null ? GLOBAL : orgId);
    return Ok(undefined);
  } catch {
    return Err({ kind: "storage-unavailable" });
  }
}

/** Shown when the browser blocks storage, so the selected context can't be remembered. */
export const CONTEXT_NOT_REMEMBERED_MESSAGE =
  "O navegador bloqueou o armazenamento local: o contexto escolhido não será lembrado ao recarregar a página.";
