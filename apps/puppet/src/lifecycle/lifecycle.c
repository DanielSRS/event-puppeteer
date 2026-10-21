#include "lifecycle.h"

#include <poll.h>
#include <sys/random.h>
#include <sys/signalfd.h>
#include <time.h>

static Lifecycle lifecycleCreate(void) {
  Lifecycle lifecycle;
  sigemptyset(&lifecycle.terminationSignals);
  sigaddset(&lifecycle.terminationSignals, SIGTERM);
  sigaddset(&lifecycle.terminationSignals, SIGINT);
  sigaddset(&lifecycle.terminationSignals, SIGHUP);
  sigprocmask(SIG_BLOCK, &lifecycle.terminationSignals, NULL);
  lifecycle.terminationDescriptor =
    signalfd(-1, &lifecycle.terminationSignals, SFD_NONBLOCK | SFD_CLOEXEC);
  return lifecycle;
}

static bool lifecycleWaitFor(const Lifecycle *lifecycle, const uint64_t seconds) {
  const struct timespec timeout = {
    .tv_sec  = (time_t)seconds,
    .tv_nsec = 0,
  };
  /** Anything but a delivered signal (timeout, EINTR) means "keep going". */
  return sigtimedwait(&lifecycle->terminationSignals, NULL, &timeout) > 0;
}

/** Failure or hang-up of a descriptor is reported as "readable": reading it is what reveals the error. */
#define LIFECYCLE_READABLE_EVENTS ((int16_t)(POLLIN | POLLHUP | POLLERR | POLLNVAL))

enum {
  LIFECYCLE_WATCH_TERMINATION = 0,
  LIFECYCLE_WATCH_DESCRIPTOR,
  LIFECYCLE_WATCH_COUNT,
};

static LifecycleActivity lifecycleWaitForActivity(
  const Lifecycle *lifecycle,
  const int32_t    descriptor,
  const bool       watchWritable,
  const uint64_t   milliseconds
) {
  struct pollfd watched[LIFECYCLE_WATCH_COUNT] = {
    [LIFECYCLE_WATCH_TERMINATION] =
      {.fd = lifecycle->terminationDescriptor, .events = POLLIN, .revents = 0},
    [LIFECYCLE_WATCH_DESCRIPTOR] =
      {.fd      = descriptor,
       .events  = (int16_t)(POLLIN | (watchWritable ? POLLOUT : 0)),
       .revents = 0},
  };
  /** `poll` takes an int; a wait that long is capped rather than wrapped. */
  const int32_t timeout = milliseconds > (uint64_t)INT32_MAX
                          ? INT32_MAX
                          : (int32_t)milliseconds;

  const LifecycleActivity none = {
    .terminationRequested = false,
    .readable             = false,
    .writable             = false,
  };
  /** EINTR and the like mean "nothing yet": the caller's loop asks again. */
  if (poll(watched, LIFECYCLE_WATCH_COUNT, timeout) <= 0) {
    return none;
  }
  return (LifecycleActivity){
    .terminationRequested =
      (watched[LIFECYCLE_WATCH_TERMINATION].revents & POLLIN) != 0,
    .readable =
      (watched[LIFECYCLE_WATCH_DESCRIPTOR].revents & LIFECYCLE_READABLE_EVENTS) != 0,
    .writable = (watched[LIFECYCLE_WATCH_DESCRIPTOR].revents & POLLOUT) != 0,
  };
}

static uint64_t lifecycleMonotonicSeconds(void) {
  struct timespec now;
  clock_gettime(CLOCK_MONOTONIC, &now);
  return (uint64_t)now.tv_sec;
}

static uint32_t lifecycleRandomValue(void) {
  uint32_t value = 0;
  if (getrandom(&value, sizeof(value), GRND_NONBLOCK) != (ssize_t)sizeof(value)) {
    return 0;
  }
  return value;
}

static void lifecycleFormatUtcNow(char *destination) {
  const time_t now = time(NULL);
  struct tm    utc;
  gmtime_r(&now, &utc);
  strftime(destination, LIFECYCLE_TIMESTAMP_CAPACITY, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

const struct LifecycleType LifecycleI = {
  .create           = lifecycleCreate,
  .waitFor          = lifecycleWaitFor,
  .waitForActivity  = lifecycleWaitForActivity,
  .monotonicSeconds = lifecycleMonotonicSeconds,
  .randomValue      = lifecycleRandomValue,
  .formatUtcNow     = lifecycleFormatUtcNow,
};
