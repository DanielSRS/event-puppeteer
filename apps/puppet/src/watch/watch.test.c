#include "testing/testing.h"
#include "watch/watch.h"

static void watchClassifiesTheAgentsLines(TestContext *context) {
  EXPECT(context, WatchI.classifyLine("[error] connect failed: network error (curl code 60)") == WATCH_LINE_ERROR);
  EXPECT(context, WatchI.classifyLine("[info] waiting for approval") == WATCH_LINE_PENDING);
  EXPECT(context, WatchI.classifyLine("[info] approved as \"lobby\" in organization north") == WATCH_LINE_APPROVED);
  EXPECT(context, WatchI.classifyLine("[info] connected as device d-42; waiting for approval") == WATCH_LINE_OTHER);
  EXPECT(context, WatchI.classifyLine("[warning] enrollment was rejected") == WATCH_LINE_OTHER);
  EXPECT(context, WatchI.classifyLine("an [error] in the middle") == WATCH_LINE_OTHER);
  EXPECT(context, WatchI.classifyLine("") == WATCH_LINE_OTHER);
}

static void watchKeepsWatchingUntilTheTimeout(TestContext *context) {
  const WatchObservation start = {.elapsedSeconds = 0, .hasEnrollmentLine = false, .enrollmentLine = WATCH_LINE_OTHER};
  EXPECT(context, WatchI.decide(&start) == WATCH_VERDICT_CONTINUE);

  const WatchObservation justBefore = {.elapsedSeconds = WATCH_TIMEOUT_SECONDS - 1, .hasEnrollmentLine = false, .enrollmentLine = WATCH_LINE_OTHER};
  EXPECT(context, WatchI.decide(&justBefore) == WATCH_VERDICT_CONTINUE);

  const WatchObservation atTimeout = {.elapsedSeconds = WATCH_TIMEOUT_SECONDS, .hasEnrollmentLine = false, .enrollmentLine = WATCH_LINE_OTHER};
  EXPECT(context, WatchI.decide(&atTimeout) == WATCH_VERDICT_TIMED_OUT);
}

static void watchFinishesOnceTheDeviceIsPendingOrApproved(TestContext *context) {
  const WatchObservation pending = {.elapsedSeconds = 5, .hasEnrollmentLine = true, .enrollmentLine = WATCH_LINE_PENDING};
  EXPECT(context, WatchI.decide(&pending) == WATCH_VERDICT_PENDING);

  const WatchObservation approved = {.elapsedSeconds = 5, .hasEnrollmentLine = true, .enrollmentLine = WATCH_LINE_APPROVED};
  EXPECT(context, WatchI.decide(&approved) == WATCH_VERDICT_APPROVED);

  /** Being pending at the last moment still counts as success. */
  const WatchObservation atTimeout = {.elapsedSeconds = WATCH_TIMEOUT_SECONDS, .hasEnrollmentLine = true, .enrollmentLine = WATCH_LINE_PENDING};
  EXPECT(context, WatchI.decide(&atTimeout) == WATCH_VERDICT_PENDING);
}

static const TestCase WATCH_TEST_CASES[] = {
  {"classifies the agent's lines", watchClassifiesTheAgentsLines},
  {"keeps watching until the timeout", watchKeepsWatchingUntilTheTimeout},
  {"finishes once the Device is pending or approved", watchFinishesOnceTheDeviceIsPendingOrApproved},
};

static const TestSuite WatchTestSuite = {
  .name      = "watch",
  .cases     = WATCH_TEST_CASES,
  .caseCount = sizeof(WATCH_TEST_CASES) / sizeof(WATCH_TEST_CASES[0]),
};
