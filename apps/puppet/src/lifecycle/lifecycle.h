/**
 * @file lifecycle.h
 * @brief Process lifecycle: termination signals, clocks and randomness.
 *
 * ## Termination without global state
 *
 * Classic signal handlers need a mutable global flag. Instead,
 * `LifecycleI.create()` *blocks* the termination signals (SIGTERM, SIGINT,
 * SIGHUP) and `LifecycleI.waitFor()` sleeps with `sigtimedwait`, which wakes
 * up early and reports termination when one of them arrives. Signals that
 * arrive while the Puppet is busy stay pending and are noticed at the next
 * wait, so in-flight requests always complete.
 *
 * Child processes inherit the blocked mask, so anything spawned must reset it
 * (see `command-executor.h`).
 *
 * Call `create` once, early in `main`, before starting any thread.
 */
#ifndef PUPPET_LIFECYCLE_H_
#define PUPPET_LIFECYCLE_H_

#include <signal.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** Length of "YYYY-MM-DDTHH:MM:SSZ" plus terminator. */
#define LIFECYCLE_TIMESTAMP_CAPACITY ((size_t)21)

typedef struct {
  /** Signals that request a graceful shutdown. */
  sigset_t terminationSignals;
} Lifecycle;

struct LifecycleType {
  /** Block the termination signals and return the lifecycle handle. */
  Lifecycle (*const create)(void);

  /**
   * Sleep for up to `seconds`, waking early on termination.
   *
   * @return true when termination was requested.
   */
  bool (*const waitFor)(const Lifecycle *lifecycle, uint64_t seconds);

  /** Seconds on a monotonic clock, immune to wall-clock adjustments. */
  uint64_t (*const monotonicSeconds)(void);

  /** A random value from the kernel's entropy pool (0 if unavailable). */
  uint32_t (*const randomValue)(void);

  /**
   * Write the current UTC time as ISO-8601 into `destination`, which must
   * hold `LIFECYCLE_TIMESTAMP_CAPACITY` bytes.
   */
  void (*const formatUtcNow)(char *destination);
};

extern const struct LifecycleType LifecycleI;

#ifdef PUPPET_LIFECYCLE_IMPLEMENTATION
#include "lifecycle.c"
#endif

#endif // PUPPET_LIFECYCLE_H_
