/**
 * @file audit-trail.h
 * @brief The Device Audit Trail: an append-only record of every change
 *        made to the Device.
 *
 * Each entry says when the change happened, who made it, what changed and
 * the state before and after. The agent and the Installation both write it,
 * so "who" is not only the agent:
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
 * {"when":"2026-01-02T03:04:05Z","who":{"kind":"command","identifier":"c1"},"what":"binary","before":"0.0.1","after":"0.0.2 sha256:..."}
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

/**
 * What changed: the `what` of every entry the Puppet writes. Shared by the
 * writers and by whoever reads the trail back, so a name never drifts.
 */
#define AUDIT_TRAIL_WHAT_ENROLLMENT         "enrollment"
#define AUDIT_TRAIL_WHAT_BINARY             "binary"
#define AUDIT_TRAIL_WHAT_UNIT               "unit"
#define AUDIT_TRAIL_WHAT_DATA_DIRECTORY     "data directory"
#define AUDIT_TRAIL_WHAT_BINARY_DIRECTORY   "binary directory"
#define AUDIT_TRAIL_WHAT_SERVICE_ENABLEMENT "service enablement"
#define AUDIT_TRAIL_WHAT_SERVICE_STATE      "service state"
#define AUDIT_TRAIL_WHAT_REBOOT             "reboot"
#define AUDIT_TRAIL_WHAT_POWEROFF           "poweroff"
/** Followed by the Command's type, e.g. "command restart". */
#define AUDIT_TRAIL_WHAT_COMMAND_PREFIX "command "

/** States written as `before` or `after`. */
#define AUDIT_TRAIL_STATE_ABSENT               "absent"
#define AUDIT_TRAIL_STATE_PRESENT              "present"
#define AUDIT_TRAIL_STATE_ENABLED              "enabled"
#define AUDIT_TRAIL_STATE_NOT_ENABLED          "not enabled"
#define AUDIT_TRAIL_STATE_ACTIVE               "active"
#define AUDIT_TRAIL_STATE_INACTIVE             "inactive"
#define AUDIT_TRAIL_STATE_RESTARTED            "restarted"
#define AUDIT_TRAIL_STATE_STARTED_NOT_ACTIVE   "started, not active"
#define AUDIT_TRAIL_STATE_RUNNING              "running"
#define AUDIT_TRAIL_STATE_REBOOT_REQUESTED     "reboot requested"
#define AUDIT_TRAIL_STATE_POWEROFF_REQUESTED   "power-off requested"
#define AUDIT_TRAIL_STATE_ACKNOWLEDGED         "acknowledged"
#define AUDIT_TRAIL_STATE_SUCCEEDED            "succeeded"
#define AUDIT_TRAIL_STATE_FAILED               "failed"
#define AUDIT_TRAIL_STATE_NOT_ENROLLED         "not enrolled"
#define AUDIT_TRAIL_STATE_CREDENTIALS_REVOKED  "credentials revoked; enrolling again"

/**
 * Starts the text of a file's content: `sha256:<hex digest>`, after the
 * version for a binary ("0.0.2 sha256:...").
 */
#define AUDIT_TRAIL_DIGEST_PREFIX "sha256:"

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
  /** The line is not valid JSON. */
  AUDIT_TRAIL_ERROR_LINE_MALFORMED = 6007,
  /** The trail has no entry about the requested change. */
  AUDIT_TRAIL_ERROR_NO_ENTRY = 6008,
  /** The trail exists but could not be read. */
  AUDIT_TRAIL_ERROR_READ_FAILED = 6009,
  /** The line is JSON, but not an object with `what` and `after`. */
  AUDIT_TRAIL_ERROR_LINE_NOT_AN_ENTRY = 6010,
  /** The entry is about another change. */
  AUDIT_TRAIL_ERROR_OTHER_CHANGE = 6011,
  /** The `after` text does not fit the destination. */
  AUDIT_TRAIL_ERROR_AFTER_TOO_LONG = 6012,
  /** A line of the trail is longer than any entry can be. */
  AUDIT_TRAIL_ERROR_LINE_TOO_LONG = 6013,
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

  /** What changed: one of the `AUDIT_TRAIL_WHAT_` names. */
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

  /**
   * Append an entry about a change made now: `append` with `when` set to the
   * current UTC time. Every writer of the trail records through this.
   *
   * @return As `append`.
   */
  AuditTrailResultCode (*const record)(
    const char           *path,
    const AuditTrailActor actor,
    const char           *what,
    const char           *before,
    const char           *after
  );

  /**
   * Read the `after` of one line of the trail, when its `what` is `what`.
   * Pure.
   *
   * @param line           The entry as one JSON line, not necessarily
   *                       null-terminated.
   * @param what           The change to look for, e.g. "enrollment".
   * @param after          Destination, null-terminated on success.
   * @param afterCapacity  Size of `after`.
   * @return `AUDIT_TRAIL_RESULT_OK`, or why the line gave nothing:
   *         `AUDIT_TRAIL_ERROR_LINE_MALFORMED`,
   *         `AUDIT_TRAIL_ERROR_LINE_NOT_AN_ENTRY`,
   *         `AUDIT_TRAIL_ERROR_OTHER_CHANGE` or
   *         `AUDIT_TRAIL_ERROR_AFTER_TOO_LONG`.
   */
  AuditTrailResultCode (*const extractAfter)(
    const char *line,
    size_t      lineLength,
    const char *what,
    char       *after,
    size_t      afterCapacity
  );

  /**
   * The `after` of the latest entry about `what`, e.g. the Enrollment state
   * last recorded. It is only as current as the trail: a change nobody
   * recorded is not in it.
   *
   * @param path           The trail's file.
   * @param what           The change to look for, e.g. "enrollment".
   * @param after          Destination, null-terminated on success.
   * @param afterCapacity  Size of `after`.
   * Every line is checked: a line that is not a well-formed entry is
   * reported, never skipped, since the trail must never silently lose a
   * change.
   *
   * @return `AUDIT_TRAIL_RESULT_OK`, `AUDIT_TRAIL_ERROR_NO_ENTRY` (also when
   *         the trail does not exist yet), `AUDIT_TRAIL_ERROR_READ_FAILED`,
   *         `AUDIT_TRAIL_ERROR_LINE_TOO_LONG`, or the code `extractAfter`
   *         gave the first line that is not a well-formed entry.
   */
  AuditTrailResultCode (*const readLatestAfter)(
    const char *path, const char *what, char *after, size_t afterCapacity
  );
};

extern const struct AuditTrailType AuditTrailI;

#ifdef PUPPET_AUDIT_TRAIL_IMPLEMENTATION
#include "audit-trail.c"
#endif

#endif // PUPPET_AUDIT_TRAIL_H_
