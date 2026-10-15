/**
 * @file audit-trail.h
 * @brief The Device Audit Trail: an append-only record of every change
 *        made to the Device.
 *
 * Each entry says when the change happened, who made it, what changed and
 * the state before and after. The agent writes it today; the Installation
 * will write to the same file, so "who" is not only the agent:
 *
 * | Kind      | Identifier                                   |
 * |-----------|----------------------------------------------|
 * | `agent`   | none: the agent itself                       |
 * | `command` | the Puppeteer Command id that caused it      |
 * | `user`    | the local operating-system user              |
 *
 * ## File format
 *
 * JSON Lines: one JSON object per line, for example
 *
 * ```json
 * {"when":"2026-01-02T03:04:05Z","who":{"kind":"command","identifier":"c1"},"what":"self-update","before":"0.0.1","after":"0.0.2"}
 * ```
 *
 * Strings are escaped, so an entry is always exactly one line.
 *
 * ## Guarantees
 *
 * - Entries are only ever appended: the file is opened `O_APPEND` and never
 *   truncated, so existing entries are never modified, even when a write
 *   fails.
 * - Each entry goes out in a single `write` under an exclusive `flock`, so
 *   processes appending at the same time produce intact, separate lines.
 *   Every writer of the trail, the Installation included, must append
 *   through `append` (or take the same `flock`): the lock is advisory.
 * - The entry is flushed to disk before `append` returns, so a record made
 *   right before a reboot or power-off survives it.
 * - A failed write is reported through the result code. Nothing is retried
 *   or hidden: the caller decides what to do with the failure.
 *
 * `format` is pure; `append` is the IO shell around it.
 */
#ifndef PUPPET_AUDIT_TRAIL_H_
#define PUPPET_AUDIT_TRAIL_H_

#include <stddef.h>
#include <stdint.h>

/** Room for one formatted entry, newline and terminator included. */
#define AUDIT_TRAIL_ENTRY_CAPACITY ((size_t)1024)

typedef enum {
  AUDIT_TRAIL_RESULT_OK = 0,

  /** The entry, once formatted, does not fit the buffer. */
  AUDIT_TRAIL_ERROR_ENTRY_TOO_LARGE = 6001,
  /** The trail could not be opened or created. */
  AUDIT_TRAIL_ERROR_OPEN_FAILED = 6002,
  /** The trail could not be locked for appending. */
  AUDIT_TRAIL_ERROR_LOCK_FAILED = 6003,
  /** The write failed before any byte of the entry was written. */
  AUDIT_TRAIL_ERROR_WRITE_FAILED = 6004,
  /** Only part of the entry was written, e.g. the disk filled up. */
  AUDIT_TRAIL_ERROR_WRITE_INCOMPLETE = 6005,
  /** The entry was written but could not be flushed to disk. */
  AUDIT_TRAIL_ERROR_SYNC_FAILED = 6006,
} AuditTrailResultCode;

typedef enum {
  /** The agent itself, with no identifier. */
  AUDIT_TRAIL_ACTOR_AGENT = 1,
  /** A Puppeteer Command; the identifier is its id. */
  AUDIT_TRAIL_ACTOR_COMMAND,
  /** A local operating-system user; the identifier is the user name. */
  AUDIT_TRAIL_ACTOR_USER,
} AuditTrailActorKind;

typedef struct {
  AuditTrailActorKind kind;

  /** NULL for `AUDIT_TRAIL_ACTOR_AGENT`, required for the other kinds. */
  const char *identifier;
} AuditTrailActor;

/** All strings are borrowed for the call. */
typedef struct {
  /** ISO-8601 UTC time of the change, e.g. "2026-01-02T03:04:05Z". */
  const char *when;

  AuditTrailActor actor;

  /** What changed, e.g. "enrollment" or "self-update". */
  const char *what;

  /** The state before and after the change, in words. */
  const char *before;
  const char *after;
} AuditTrailEntry;

struct AuditTrailType {
  /**
   * Format `entry` as one newline-terminated JSON line.
   *
   * @param buffer    Destination, null-terminated on success.
   * @param capacity  Size of `buffer`; `AUDIT_TRAIL_ENTRY_CAPACITY` fits any
   *                  entry the agent writes.
   * @return `AUDIT_TRAIL_RESULT_OK` or `AUDIT_TRAIL_ERROR_ENTRY_TOO_LARGE`.
   */
  AuditTrailResultCode (*const format)(
    const AuditTrailEntry *entry, char *buffer, size_t capacity
  );

  /**
   * Append `entry` to the trail at `path`, creating it when missing.
   *
   * @return `AUDIT_TRAIL_RESULT_OK`, or the code of the step that failed.
   *         On any failure existing entries are untouched.
   */
  AuditTrailResultCode (*const append)(
    const char *path, const AuditTrailEntry *entry
  );
};

extern const struct AuditTrailType AuditTrailI;

#ifdef PUPPET_AUDIT_TRAIL_IMPLEMENTATION
#include "audit-trail.c"
#endif

#endif // PUPPET_AUDIT_TRAIL_H_
