/**
 * @file watch.h
 * @brief The pure rules of the terminal watching the agent (ADR-0001).
 *
 * After the terminal installs or repairs, it watches the agent for up to
 * `WATCH_TIMEOUT_SECONDS`, until the Device is pending in Enrollment. The
 * evidence is what the agent itself logs from the moment the terminal
 * started the watch: a stored record could predate it and say nothing about
 * whether the agent connects now. These rules classify the agent's log lines
 * and decide when to stop. The IO around them lives in `watcher.h`.
 */
#ifndef PUPPET_WATCH_H_
#define PUPPET_WATCH_H_

#include <stdbool.h>
#include <stdint.h>

/** How long the terminal waits for the Device to become pending. */
#define WATCH_TIMEOUT_SECONDS ((uint64_t)60)

/** What one log line of the agent says. */
typedef enum {
  /** Nothing the watch acts on. */
  WATCH_LINE_OTHER = 1,
  /** `[error] ...`: a failure to keep for the timeout message. */
  WATCH_LINE_ERROR,
  /** Puppeteer knows the Device and waits for an Admin to approve it. */
  WATCH_LINE_PENDING,
  /** Puppeteer approved the Device. */
  WATCH_LINE_APPROVED,
} WatchLineKind;

typedef enum {
  /** Nothing decisive yet: keep watching. */
  WATCH_VERDICT_CONTINUE = 1,
  /** The Device is pending, waiting for approval: show the summary. */
  WATCH_VERDICT_PENDING,
  /** The Device is already approved: show the summary. */
  WATCH_VERDICT_APPROVED,
  /** The time is over and the Device is not pending. */
  WATCH_VERDICT_TIMED_OUT,
} WatchVerdict;

/** What the terminal has seen so far. */
typedef struct {
  uint64_t elapsedSeconds;

  /** The most recent `WATCH_LINE_PENDING` or `WATCH_LINE_APPROVED`, if any. */
  bool          hasEnrollmentLine;
  WatchLineKind enrollmentLine;
} WatchObservation;

struct WatchType {
  /** What `line` (without its newline) says. */
  WatchLineKind (*const classifyLine)(const char *line);

  /**
   * Whether to keep watching, show the summary, or give up. A Device that is
   * pending (or approved) on the last moment still counts as success.
   */
  WatchVerdict (*const decide)(const WatchObservation *observation);
};

extern const struct WatchType WatchI;

#ifdef PUPPET_WATCH_IMPLEMENTATION
#include "watch.c"
#endif

#endif // PUPPET_WATCH_H_
