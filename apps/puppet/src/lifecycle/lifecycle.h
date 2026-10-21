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
 * `waitForActivity` does the same through a `signalfd`, so one `poll` can
 * wait for a termination signal and for a network socket at once.
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

  /**
   * Descriptor that becomes readable when one of them is pending, so a wait
   * on other descriptors (see `waitForActivity`) wakes up for termination
   * too. Negative when the kernel refused to create it: the caller must then
   * refuse to run.
   */
  int32_t terminationDescriptor;
} Lifecycle;

/** Pass as the descriptor of `waitForActivity` to watch only for termination. */
#define LIFECYCLE_NO_DESCRIPTOR ((int32_t)-1)

/** `signalfd` argument that asks for a new descriptor instead of updating one. */
#define LIFECYCLE_NEW_SIGNAL_DESCRIPTOR ((int32_t)-1)

/** What `waitForActivity` found out. */
typedef struct {
  /** A termination signal is pending. */
  bool terminationRequested;
  /** The watched descriptor has data to read, or has failed or hung up. */
  bool readable;
  /** The watched descriptor accepts data to write. */
  bool writable;
} LifecycleActivity;

struct LifecycleType {
  /** Block the termination signals and return the lifecycle handle. */
  Lifecycle (*const create)(void);

  /**
   * Sleep for up to `seconds`, waking early on termination.
   *
   * @return true when termination was requested.
   */
  bool (*const waitFor)(const Lifecycle *lifecycle, uint64_t seconds);

  /**
   * Sleep for up to `milliseconds`, waking early on termination or on
   * activity on `descriptor`, so a single thread serves a network connection
   * and still reacts to signals at once.
   *
   * @param descriptor      Descriptor to watch, or a negative value for none.
   * @param watchWritable   Also report when `descriptor` accepts writes.
   */
  LifecycleActivity (*const waitForActivity)(
    const Lifecycle *lifecycle,
    int32_t          descriptor,
    bool             watchWritable,
    uint64_t         milliseconds
  );

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
