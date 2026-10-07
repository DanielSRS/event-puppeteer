/**
 * @file testing.h
 * @brief Minimal, dependency-free unit testing primitives.
 *
 * Each `*.test.c` file exposes a `const TestSuite` listing its cases. The
 * central test runner (`src/test-runner.c`) instantiates the modules under
 * test, includes every suite, and executes them.
 *
 * ## Writing a test
 *
 * ```c
 * static void jsonParsesEmptyObject(TestContext *context) {
 *   EXPECT(context, result.code == JSON_RESULT_OK);
 * }
 *
 * static const TestCase JSON_TEST_CASES[] = {
 *   {"parses an empty object", jsonParsesEmptyObject},
 * };
 *
 * static const TestSuite JsonTestSuite = {
 *   .name      = "json",
 *   .cases     = JSON_TEST_CASES,
 *   .caseCount = sizeof(JSON_TEST_CASES) / sizeof(JSON_TEST_CASES[0]),
 * };
 * ```
 */
#ifndef PUPPET_TESTING_H_
#define PUPPET_TESTING_H_

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

/** Accumulated results for a whole test run. */
typedef struct {
  uint32_t checkCount;
  uint32_t failureCount;

  /** Name of the case being executed, used to label failures. */
  const char *currentCaseName;
} TestContext;

typedef void (*TestFunction)(TestContext *context);

typedef struct {
  const char  *name;
  TestFunction run;
} TestCase;

typedef struct {
  const char     *name;
  const TestCase *cases;
  uint32_t        caseCount;
} TestSuite;

/** Records a single check, printing the location when it fails. */
static inline void testingExpect(
  TestContext *context,
  const bool   condition,
  const char  *expressionText,
  const char  *fileName,
  const int32_t lineNumber
) {
  context->checkCount++;
  if (condition) {
    return;
  }
  context->failureCount++;
  printf(
    "  FAIL %s\n    %s:%d: %s\n",
    context->currentCaseName,
    fileName,
    lineNumber,
    expressionText
  );
}

/**
 * Asserts that `condition` holds within a test case.
 *
 * A macro is required (instead of a function) to capture the stringified
 * expression together with `__FILE__` and `__LINE__` of the call site.
 */
#define EXPECT(context, condition)                                             \
  testingExpect((context), (condition), #condition, __FILE__, __LINE__)

#endif // PUPPET_TESTING_H_
