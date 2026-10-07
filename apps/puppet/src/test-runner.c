/**
 * Central test runner.
 *
 * Instantiates every module under test (STB-style implementation macros) and
 * includes each co-located `*.test.c` suite into this single translation
 * unit, then runs them all. Exits non-zero when any check fails.
 */
#define PUPPET_JSON_IMPLEMENTATION
#include "json/json.h"

#include "testing/testing.h"

#include "json/json.test.c"

#include <stdio.h>

/** Process exit status reported when at least one check failed. */
#define TEST_RUNNER_FAILURE_EXIT_CODE 1

static const TestSuite *const TEST_SUITES[] = {
  &JsonTestSuite,
};

int main(void) {
  TestContext context = {
    .checkCount      = 0,
    .failureCount    = 0,
    .currentCaseName = "",
  };

  const uint32_t suiteCount = sizeof(TEST_SUITES) / sizeof(TEST_SUITES[0]);
  for (uint32_t suiteIndex = 0; suiteIndex < suiteCount; suiteIndex++) {
    const TestSuite *suite = TEST_SUITES[suiteIndex];
    printf("%s\n", suite->name);
    for (uint32_t caseIndex = 0; caseIndex < suite->caseCount; caseIndex++) {
      const TestCase *testCase      = &suite->cases[caseIndex];
      const uint32_t  failuresBefore = context.failureCount;
      context.currentCaseName        = testCase->name;
      testCase->run(&context);
      printf(
        "  %s %s\n",
        context.failureCount == failuresBefore ? "ok  " : "FAIL",
        testCase->name
      );
    }
  }

  printf(
    "\n%u checks, %u failed\n", context.checkCount, context.failureCount
  );
  return context.failureCount == 0 ? 0 : TEST_RUNNER_FAILURE_EXIT_CODE;
}
