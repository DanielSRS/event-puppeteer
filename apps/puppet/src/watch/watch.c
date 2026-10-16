#include "watch.h"

#include <string.h>

/**
 * The lines `agent.c` logs when the Device's Enrollment phase changes, and
 * the prefix it gives errors. They are the agent's own report of what
 * Puppeteer said.
 */
#define WATCH_ERROR_PREFIX    "[error]"
#define WATCH_PENDING_LINE    "[info] waiting for approval"
#define WATCH_APPROVED_PREFIX "[info] approved as"

static bool watchStartsWith(const char *text, const char *prefix) {
  return strncmp(text, prefix, strlen(prefix)) == 0;
}

static WatchLineKind watchClassifyLine(const char *line) {
  if (watchStartsWith(line, WATCH_ERROR_PREFIX)) {
    return WATCH_LINE_ERROR;
  }
  if (watchStartsWith(line, WATCH_PENDING_LINE)) {
    return WATCH_LINE_PENDING;
  }
  if (watchStartsWith(line, WATCH_APPROVED_PREFIX)) {
    return WATCH_LINE_APPROVED;
  }
  return WATCH_LINE_OTHER;
}

static WatchVerdict watchDecide(const WatchObservation *observation) {
  if (observation->hasEnrollmentLine) {
    return observation->enrollmentLine == WATCH_LINE_APPROVED
           ? WATCH_VERDICT_APPROVED
           : WATCH_VERDICT_PENDING;
  }
  return observation->elapsedSeconds >= WATCH_TIMEOUT_SECONDS
         ? WATCH_VERDICT_TIMED_OUT
         : WATCH_VERDICT_CONTINUE;
}

const struct WatchType WatchI = {
  .classifyLine = watchClassifyLine,
  .decide       = watchDecide,
};
