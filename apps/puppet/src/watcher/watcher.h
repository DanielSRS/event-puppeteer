/**
 * @file watcher.h
 * @brief The terminal watching the agent after an install or repair
 *        (ADR-0001).
 *
 * `watch` streams the service's journal lines live until `WatchI.decide`
 * says the Device is pending, or time is up.
 *
 * The terminal is a read-only observer:
 *
 * - it never takes the agent lock and never opens the agent's storage (so
 *   the token, the feed and the Command queue are out of its reach);
 * - the Enrollment state is what the agent logs about it, from the start of
 *   the watch on: the MMKV wrapper has no read-only mode, and a record in
 *   the Audit Trail could predate this run;
 * - it only reads the journal. Closing the terminal ends the watch and
 *   nothing else: the agent belongs to systemd.
 *
 * This default implementation targets systemd-based Linux (`journalctl`).
 */
#ifndef PUPPET_WATCHER_H_
#define PUPPET_WATCHER_H_

typedef enum {
  WATCHER_RESULT_OK = 0,

  /** The pipe to read the journal could not be made. */
  WATCHER_ERROR_PIPE_FAILED = 9001,
  /** `journalctl` could not be started. */
  WATCHER_ERROR_JOURNAL_UNAVAILABLE = 9002,
  /** Waiting for journal lines failed. */
  WATCHER_ERROR_WAIT_FAILED = 9003,
  /** The time ran out before the Device became pending. */
  WATCHER_ERROR_TIMED_OUT = 9004,
  /** The pipe's descriptors could not be made close-on-exec. */
  WATCHER_ERROR_PIPE_FLAGS_FAILED = 9005,
  /** `journalctl` ended on its own. */
  WATCHER_ERROR_JOURNAL_ENDED = 9006,
} WatcherResultCode;

/** Everything the watch needs from the outside. Strings are borrowed. */
typedef struct {
  /** Only journal lines from this time on, as `journalctl --since` reads it. */
  const char *since;

  /** Shown in the summary. */
  const char *deviceIdentifier;

} WatcherInputs;

struct WatcherType {
  /**
   * Show the agent's journal until the Device is pending.
   *
   * Prints the log lines as they come, then the summary (connected to
   * Puppeteer, waiting for approval or approved, Device identifier) on
   * success. On
   * `WATCHER_ERROR_TIMED_OUT` it prints the agent's last error line instead;
   * the service keeps retrying on its own.
   *
   * @return `WATCHER_RESULT_OK`, or the code of what went wrong.
   */
  WatcherResultCode (*const watch)(const WatcherInputs *inputs);
};

extern const struct WatcherType WatcherI;

#ifdef PUPPET_WATCHER_IMPLEMENTATION
#include "watcher.c"
#endif

#endif // PUPPET_WATCHER_H_
