#include "audit-trail/audit-trail.h"
#include "testing/testing.h"

#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#define AUDIT_TRAIL_TEST_PATH_CAPACITY    ((size_t)64)
#define AUDIT_TRAIL_TEST_FILE_CAPACITY    ((size_t)65536)
#define AUDIT_TRAIL_TEST_WRITER_COUNT     ((uint32_t)4)
#define AUDIT_TRAIL_TEST_ENTRIES_PER_WRITER ((uint32_t)50)

static AuditTrailEntry auditTrailTestEntry(
  const AuditTrailActor actor, const char *before, const char *after
) {
  return (AuditTrailEntry){
    .when   = "2026-01-02T03:04:05Z",
    .actor  = actor,
    .what   = "enrollment",
    .before = before,
    .after  = after,
  };
}

static const AuditTrailActor AUDIT_TRAIL_TEST_AGENT = {
  .kind = AUDIT_TRAIL_ACTOR_AGENT, .identifier = NULL
};

static void auditTrailFormatsAgentEntries(TestContext *context) {
  const AuditTrailEntry entry =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "pending", "active");
  char buffer[AUDIT_TRAIL_ENTRY_CAPACITY];

  EXPECT(
    context,
    AuditTrailI.format(&entry, buffer, sizeof(buffer)) == AUDIT_TRAIL_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(
      buffer,
      "{\"when\":\"2026-01-02T03:04:05Z\",\"who\":{\"kind\":\"agent\"},"
      "\"what\":\"enrollment\",\"before\":\"pending\",\"after\":\"active\"}\n"
    ) == 0
  );
}

static void auditTrailNamesCommandsAndUsers(TestContext *context) {
  char buffer[AUDIT_TRAIL_ENTRY_CAPACITY];

  const AuditTrailEntry byCommand = auditTrailTestEntry(
    (AuditTrailActor){
      .kind = AUDIT_TRAIL_ACTOR_COMMAND, .identifier = "cmd-7"
    },
    "0.0.1",
    "0.0.2"
  );
  EXPECT(
    context,
    AuditTrailI.format(&byCommand, buffer, sizeof(buffer))
      == AUDIT_TRAIL_RESULT_OK
  );
  EXPECT(
    context,
    strstr(buffer, "\"who\":{\"kind\":\"command\",\"identifier\":\"cmd-7\"}")
      != NULL
  );

  const AuditTrailEntry byUser = auditTrailTestEntry(
    (AuditTrailActor){.kind = AUDIT_TRAIL_ACTOR_USER, .identifier = "technician"},
    "absent",
    "installed"
  );
  EXPECT(
    context,
    AuditTrailI.format(&byUser, buffer, sizeof(buffer)) == AUDIT_TRAIL_RESULT_OK
  );
  EXPECT(
    context,
    strstr(buffer, "\"who\":{\"kind\":\"user\",\"identifier\":\"technician\"}")
      != NULL
  );
}

static void auditTrailKeepsBeforeAndAfterVerbatim(TestContext *context) {
  const AuditTrailEntry entry = auditTrailTestEntry(
    AUDIT_TRAIL_TEST_AGENT, "version \"0.0.1\"", "line one\nline two"
  );
  char buffer[AUDIT_TRAIL_ENTRY_CAPACITY];

  EXPECT(
    context,
    AuditTrailI.format(&entry, buffer, sizeof(buffer)) == AUDIT_TRAIL_RESULT_OK
  );
  EXPECT(
    context,
    strstr(buffer, "\"before\":\"version \\\"0.0.1\\\"\"") != NULL
  );
  /** One entry is exactly one line, whatever the values contain. */
  EXPECT(context, strchr(buffer, '\n') == buffer + strlen(buffer) - 1);
}

static void auditTrailRejectsEntriesThatDoNotFit(TestContext *context) {
  const AuditTrailEntry entry =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "pending", "active");
  char buffer[16];

  EXPECT(
    context,
    AuditTrailI.format(&entry, buffer, sizeof(buffer))
      == AUDIT_TRAIL_ERROR_ENTRY_TOO_LARGE
  );
}

static void auditTrailTestPath(char *path) {
  snprintf(
    path,
    AUDIT_TRAIL_TEST_PATH_CAPACITY,
    "/tmp/dsrs-puppet-audit-trail-test-%d.jsonl",
    (int32_t)getpid()
  );
}

/** Read the whole trail into `contents`; returns its length. */
static size_t auditTrailTestRead(const char *path, char *contents) {
  const int32_t descriptor = open(path, O_RDONLY);
  if (descriptor < 0) {
    contents[0] = '\0';
    return 0;
  }
  const ssize_t length =
    read(descriptor, contents, AUDIT_TRAIL_TEST_FILE_CAPACITY - 1);
  close(descriptor);
  contents[length < 0 ? 0 : (size_t)length] = '\0';
  return length < 0 ? 0 : (size_t)length;
}

static void auditTrailAppendsWithoutRewriting(TestContext *context) {
  char path[AUDIT_TRAIL_TEST_PATH_CAPACITY];
  auditTrailTestPath(path);
  unlink(path);

  const AuditTrailEntry first =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "pending", "active");
  const AuditTrailEntry second =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "active", "rejected");
  EXPECT(context, AuditTrailI.append(path, &first) == AUDIT_TRAIL_RESULT_OK);

  static char afterFirst[AUDIT_TRAIL_TEST_FILE_CAPACITY];
  static char afterSecond[AUDIT_TRAIL_TEST_FILE_CAPACITY];
  const size_t firstLength = auditTrailTestRead(path, afterFirst);
  EXPECT(context, AuditTrailI.append(path, &second) == AUDIT_TRAIL_RESULT_OK);
  auditTrailTestRead(path, afterSecond);

  EXPECT(context, firstLength > 0);
  EXPECT(context, strncmp(afterSecond, afterFirst, firstLength) == 0);
  EXPECT(context, strstr(afterSecond + firstLength, "rejected") != NULL);
  unlink(path);
}

static void auditTrailReportsAWriteThatCannotHappen(TestContext *context) {
  const AuditTrailEntry entry =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "pending", "active");

  EXPECT(
    context,
    AuditTrailI.append("/nonexistent-directory/audit-trail.jsonl", &entry)
      == AUDIT_TRAIL_ERROR_OPEN_FAILED
  );
}

static void auditTrailKeepsConcurrentEntriesIntact(TestContext *context) {
  char path[AUDIT_TRAIL_TEST_PATH_CAPACITY];
  auditTrailTestPath(path);
  unlink(path);

  pid_t writers[AUDIT_TRAIL_TEST_WRITER_COUNT];
  for (uint32_t writer = 0; writer < AUDIT_TRAIL_TEST_WRITER_COUNT; writer++) {
    writers[writer] = fork();
    if (writers[writer] == 0) {
      const AuditTrailEntry entry =
        auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "before", "after");
      for (uint32_t count = 0; count < AUDIT_TRAIL_TEST_ENTRIES_PER_WRITER;
           count++) {
        if (AuditTrailI.append(path, &entry) != AUDIT_TRAIL_RESULT_OK) {
          _exit(1);
        }
      }
      _exit(0);
    }
  }
  for (uint32_t writer = 0; writer < AUDIT_TRAIL_TEST_WRITER_COUNT; writer++) {
    int32_t status = 0;
    waitpid(writers[writer], &status, 0);
    EXPECT(context, WIFEXITED(status) && WEXITSTATUS(status) == 0);
  }

  char expected[AUDIT_TRAIL_ENTRY_CAPACITY];
  const AuditTrailEntry entry =
    auditTrailTestEntry(AUDIT_TRAIL_TEST_AGENT, "before", "after");
  AuditTrailI.format(&entry, expected, sizeof(expected));

  static char contents[AUDIT_TRAIL_TEST_FILE_CAPACITY];
  const size_t length      = auditTrailTestRead(path, contents);
  const size_t entryLength = strlen(expected);
  EXPECT(
    context,
    length
      == entryLength * AUDIT_TRAIL_TEST_WRITER_COUNT
           * AUDIT_TRAIL_TEST_ENTRIES_PER_WRITER
  );
  bool intact = length % entryLength == 0;
  for (size_t offset = 0; intact && offset < length; offset += entryLength) {
    intact = strncmp(contents + offset, expected, entryLength) == 0;
  }
  EXPECT(context, intact);
  unlink(path);
}

static const TestCase AUDIT_TRAIL_TEST_CASES[] = {
  {"formats an agent entry as one JSON line", auditTrailFormatsAgentEntries},
  {"names the Command or user who made the change", auditTrailNamesCommandsAndUsers},
  {"keeps before and after verbatim and on one line", auditTrailKeepsBeforeAndAfterVerbatim},
  {"rejects entries that do not fit instead of truncating", auditTrailRejectsEntriesThatDoNotFit},
  {"appends without rewriting existing entries", auditTrailAppendsWithoutRewriting},
  {"reports a trail that cannot be opened", auditTrailReportsAWriteThatCannotHappen},
  {"keeps entries from concurrent writers intact", auditTrailKeepsConcurrentEntriesIntact},
};

static const TestSuite AuditTrailTestSuite = {
  .name      = "audit trail",
  .cases     = AUDIT_TRAIL_TEST_CASES,
  .caseCount = sizeof(AUDIT_TRAIL_TEST_CASES) / sizeof(AUDIT_TRAIL_TEST_CASES[0]),
};
