/**
 * @file agent-lock.h
 * @brief Guarantees that a single agent runs on a Device.
 *
 * The agent takes a non-blocking exclusive `flock` on the lock file at
 * startup and holds it for its whole life. The kernel releases it when the
 * holder dies, so a crash never leaves a stale lock, and a second agent
 * fails at once with `AGENT_LOCK_ERROR_HELD` instead of waiting.
 *
 * ## Surviving a self-update restart
 *
 * The restart is an `execv` in the same process. An `flock` belongs to the
 * open file description, which an `execv` keeps as long as the descriptor
 * is not close-on-exec. So the lock lives on a descriptor at the fixed
 * number `AGENT_LOCK_DESCRIPTOR`:
 *
 * 1. `acquire` places it there, close-on-exec, so spawned children (the
 *    Command executor) never inherit it;
 * 2. `keepAcrossRestart` clears close-on-exec right before the `execv`;
 * 3. the new image's `acquire` finds the descriptor open, checks that it
 *    refers to the lock file and locks it again. That is a no-op on the
 *    description it already holds, so the lock is never released and no
 *    other agent can slip in between.
 *
 * Call `acquire` first thing in `main`, before any other descriptor is
 * opened.
 */
#ifndef PUPPET_AGENT_LOCK_H_
#define PUPPET_AGENT_LOCK_H_

#include <stdint.h>

/**
 * Descriptor number the lock is held on, so a restarted image can find it.
 * High enough not to collide with the descriptors a process opens at
 * startup.
 */
#define AGENT_LOCK_DESCRIPTOR ((int32_t)63)

typedef enum {
  AGENT_LOCK_RESULT_OK = 0,

  /** Another agent holds the lock. */
  AGENT_LOCK_ERROR_HELD = 5001,
  /** The lock file could not be opened or created. */
  AGENT_LOCK_ERROR_OPEN_FAILED = 5002,
  /** `flock` failed for a reason other than another holder. */
  AGENT_LOCK_ERROR_LOCK_FAILED = 5003,
  /** The lock could not be moved to `AGENT_LOCK_DESCRIPTOR`. */
  AGENT_LOCK_ERROR_PLACEMENT_FAILED = 5004,
  /** `AGENT_LOCK_DESCRIPTOR` is open but is not the lock file. */
  AGENT_LOCK_ERROR_DESCRIPTOR_OCCUPIED = 5005,
  /** Close-on-exec could not be cleared before a restart. */
  AGENT_LOCK_ERROR_RESTART_PREPARATION_FAILED = 5006,
} AgentLockResultCode;

struct AgentLockType {
  /**
   * Take the lock at `path`, or recognize the one inherited across a
   * restart. Creates the file when missing.
   *
   * @param path  Lock file. Borrowed for the call.
   * @return `AGENT_LOCK_RESULT_OK` when this process now holds the lock;
   *         `AGENT_LOCK_ERROR_HELD` when another agent does; otherwise the
   *         code of the step that failed. The lock is held on
   *         `AGENT_LOCK_DESCRIPTOR` for the rest of the process.
   */
  AgentLockResultCode (*const acquire)(const char *path);

  /**
   * Let the held lock cross the next `execv`. Call right before it.
   *
   * @return `AGENT_LOCK_RESULT_OK` or `AGENT_LOCK_ERROR_RESTART_PREPARATION_FAILED`;
   *         on failure the lock would be dropped by the `execv`, so do
   *         not restart.
   */
  AgentLockResultCode (*const keepAcrossRestart)(void);

  /** Give the lock up. The kernel does this on exit; tests need it sooner. */
  void (*const release)(void);
};

extern const struct AgentLockType AgentLockI;

#ifdef PUPPET_AGENT_LOCK_IMPLEMENTATION
#include "agent-lock.c"
#endif

#endif // PUPPET_AGENT_LOCK_H_
