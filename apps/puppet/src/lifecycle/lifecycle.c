#include "lifecycle.h"

#include <sys/random.h>
#include <time.h>

static Lifecycle lifecycleCreate(void) {
  Lifecycle lifecycle;
  sigemptyset(&lifecycle.terminationSignals);
  sigaddset(&lifecycle.terminationSignals, SIGTERM);
  sigaddset(&lifecycle.terminationSignals, SIGINT);
  sigaddset(&lifecycle.terminationSignals, SIGHUP);
  sigprocmask(SIG_BLOCK, &lifecycle.terminationSignals, NULL);
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
  .monotonicSeconds = lifecycleMonotonicSeconds,
  .randomValue      = lifecycleRandomValue,
  .formatUtcNow     = lifecycleFormatUtcNow,
};
