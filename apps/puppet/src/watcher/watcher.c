#include "watcher.h"

#include "config/config.h"
#include "lifecycle/lifecycle.h"
#include "watch/watch.h"

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

/** The process environment, required by posix_spawnp for the child. */
extern char **environ;

/** The journal reader and the options that make it follow one unit. */
#define WATCHER_JOURNAL_PROGRAM "journalctl"
#define WATCHER_QUIET_OPTION    "--quiet"
#define WATCHER_UNIT_OPTION     "--unit"
#define WATCHER_FOLLOW_OPTION   "--follow"
#define WATCHER_SINCE_OPTION    "--since"
#define WATCHER_OUTPUT_OPTION   "--output"

/** Only the message, as the agent wrote it: the line rules match on it. */
#define WATCHER_MESSAGE_ONLY_FORMAT "cat"

/** Longest journal line kept whole; longer ones are shown in pieces. */
#define WATCHER_LINE_CAPACITY ((size_t)512)

/** Bytes read from the journal at once. */
#define WATCHER_READ_CAPACITY ((size_t)1024)

/** How long to wait for a journal line before checking the clock again. */
#define WATCHER_POLL_MILLISECONDS ((int32_t)1000)

typedef struct {
  char   current[WATCHER_LINE_CAPACITY];
  size_t currentLength;

  /** The last `[error]` line, for the timeout message. */
  char lastError[WATCHER_LINE_CAPACITY];
  bool hasError;

  /** The last line that said where the Enrollment stands. */
  char          enrollment[WATCHER_LINE_CAPACITY];
  bool          hasEnrollment;
  WatchLineKind enrollmentKind;
} WatcherLines;

static void watcherEndLine(WatcherLines *lines) {
  lines->current[lines->currentLength] = '\0';
  printf("%s\n", lines->current);
  fflush(stdout);
  const WatchLineKind kind = WatchI.classifyLine(lines->current);
  if (kind == WATCH_LINE_ERROR) {
    memcpy(lines->lastError, lines->current, lines->currentLength + 1);
    lines->hasError = true;
  } else if (kind == WATCH_LINE_PENDING || kind == WATCH_LINE_APPROVED) {
    memcpy(lines->enrollment, lines->current, lines->currentLength + 1);
    lines->hasEnrollment  = true;
    lines->enrollmentKind = kind;
  }
  lines->currentLength = 0;
}

static void watcherFeed(WatcherLines *lines, const char *data, const size_t length) {
  for (size_t index = 0; index < length; index++) {
    if (data[index] == '\n') {
      watcherEndLine(lines);
      continue;
    }
    lines->current[lines->currentLength++] = data[index];
    if (lines->currentLength == WATCHER_LINE_CAPACITY - 1) {
      watcherEndLine(lines);
    }
  }
}

/** `journalctl -u <service> -f --since <since>`, read from `pipeEnds[0]`. */
static WatcherResultCode watcherStartJournal(
  const char *since, int32_t *pipeEnds, pid_t *child
) {
  if (pipe(pipeEnds) != 0) {
    return WATCHER_ERROR_PIPE_FAILED;
  }
  if (fcntl(pipeEnds[0], F_SETFD, FD_CLOEXEC) != 0
      || fcntl(pipeEnds[1], F_SETFD, FD_CLOEXEC) != 0) {
    close(pipeEnds[0]);
    close(pipeEnds[1]);
    return WATCHER_ERROR_PIPE_FLAGS_FAILED;
  }
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  posix_spawn_file_actions_adddup2(&actions, pipeEnds[1], STDOUT_FILENO);

  char program[]      = WATCHER_JOURNAL_PROGRAM;
  char quiet[]        = WATCHER_QUIET_OPTION;
  char unitOption[]   = WATCHER_UNIT_OPTION;
  char unit[]         = CONFIG_SERVICE_NAME;
  char follow[]       = WATCHER_FOLLOW_OPTION;
  char sinceOption[]  = WATCHER_SINCE_OPTION;
  char outputOption[] = WATCHER_OUTPUT_OPTION;
  char output[]       = WATCHER_MESSAGE_ONLY_FORMAT;
  char sinceValue[LIFECYCLE_TIMESTAMP_CAPACITY];
  snprintf(sinceValue, sizeof(sinceValue), "%s", since);
  char *arguments[] = {
    program, quiet, unitOption, unit, follow, sinceOption, sinceValue, outputOption, output, NULL
  };
  const int32_t status =
    posix_spawnp(child, program, &actions, NULL, arguments, environ);
  posix_spawn_file_actions_destroy(&actions);
  close(pipeEnds[1]);
  if (status != 0) {
    close(pipeEnds[0]);
    fprintf(stderr, "[error] cannot run %s: %s\n", WATCHER_JOURNAL_PROGRAM, strerror(status));
    return WATCHER_ERROR_JOURNAL_UNAVAILABLE;
  }
  return WATCHER_RESULT_OK;
}

static void watcherStopJournal(const int32_t pipeEnd, const pid_t child) {
  close(pipeEnd);
  kill(child, SIGTERM);
  waitpid(child, NULL, 0);
}

/** Show whatever the journal has to say within one poll interval. */
static WatcherResultCode watcherPump(const int32_t pipeEnd, WatcherLines *lines) {
  struct pollfd waiting = {.fd = pipeEnd, .events = POLLIN, .revents = 0};
  const int32_t ready   = poll(&waiting, 1, WATCHER_POLL_MILLISECONDS);
  if (ready < 0 && errno != EINTR) {
    return WATCHER_ERROR_WAIT_FAILED;
  }
  if (ready <= 0) {
    return WATCHER_RESULT_OK;
  }
  char          chunk[WATCHER_READ_CAPACITY];
  const ssize_t count = read(pipeEnd, chunk, sizeof(chunk));
  if (count < 0 && errno == EINTR) {
    return WATCHER_RESULT_OK;
  }
  if (count <= 0) {
    return WATCHER_ERROR_JOURNAL_ENDED;
  }
  watcherFeed(lines, chunk, (size_t)count);
  return WATCHER_RESULT_OK;
}

static void watcherReportPending(
  const WatchVerdict verdict, const WatcherLines *lines, const char *deviceIdentifier
) {
  printf(
    verdict == WATCH_VERDICT_PENDING
      ? "the Puppet is connected to Puppeteer, waiting for approval\n"
      : "the Puppet is connected to Puppeteer and the Device is approved\n"
  );
  printf("  agent said:         %s\n", lines->enrollment);
  printf("  device identifier:  %s\n", deviceIdentifier);
}

static void watcherReportTimeout(const WatcherLines *lines) {
  fprintf(
    stderr,
    "[error] the Device is not pending after %u seconds; "
    "the agent's last error: %s\n"
    "the service keeps retrying on its own\n",
    (uint32_t)WATCH_TIMEOUT_SECONDS,
    lines->hasError ? lines->lastError : "the agent logged none"
  );
}

static WatcherResultCode watcherWatch(const WatcherInputs *inputs) {
  int32_t           pipeEnds[2];
  pid_t             child = 0;
  WatcherResultCode code  = watcherStartJournal(inputs->since, pipeEnds, &child);
  if (code != WATCHER_RESULT_OK) {
    return code;
  }

  const uint64_t startSeconds = LifecycleI.monotonicSeconds();
  WatcherLines   lines        = {
    .current        = "",
    .currentLength  = 0,
    .lastError      = "",
    .hasError       = false,
    .enrollment     = "",
    .hasEnrollment  = false,
    .enrollmentKind = WATCH_LINE_OTHER,
  };
  WatchVerdict verdict = WATCH_VERDICT_CONTINUE;
  while (verdict == WATCH_VERDICT_CONTINUE && code == WATCHER_RESULT_OK) {
    code = watcherPump(pipeEnds[0], &lines);
    const WatchObservation observation = {
      .elapsedSeconds    = LifecycleI.monotonicSeconds() - startSeconds,
      .hasEnrollmentLine = lines.hasEnrollment,
      .enrollmentLine    = lines.enrollmentKind,
    };
    verdict = WatchI.decide(&observation);
  }
  watcherStopJournal(pipeEnds[0], child);
  const bool enrolled =
    verdict == WATCH_VERDICT_PENDING || verdict == WATCH_VERDICT_APPROVED;
  if (code != WATCHER_RESULT_OK && !enrolled) {
    return code;
  }
  if (verdict == WATCH_VERDICT_TIMED_OUT) {
    watcherReportTimeout(&lines);
    return WATCHER_ERROR_TIMED_OUT;
  }
  watcherReportPending(verdict, &lines, inputs->deviceIdentifier);
  return WATCHER_RESULT_OK;
}

const struct WatcherType WatcherI = {
  .watch = watcherWatch,
};
