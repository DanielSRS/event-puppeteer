#include "agent-lock/agent-lock.h"
#include "testing/testing.h"

#include <fcntl.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

#define AGENT_LOCK_TEST_PATH_CAPACITY ((size_t)64)

static void agentLockTestPath(char *path) {
  snprintf(
    path,
    AGENT_LOCK_TEST_PATH_CAPACITY,
    "/tmp/dsrs-puppet-agent-lock-test-%d.lock",
    (int32_t)getpid()
  );
}

/** Exit statuses the forked agent reports back to the test. */
typedef enum {
  AGENT_LOCK_TEST_CHILD_ACQUIRED = 0,
  AGENT_LOCK_TEST_CHILD_REFUSED  = 1,
  AGENT_LOCK_TEST_CHILD_FAILED   = 2,
} AgentLockTestChildStatus;

/**
 * Acquire as an independent agent would: a new process with no inherited
 * lock descriptor.
 */
static AgentLockTestChildStatus agentLockTestAcquireAsOtherAgent(
  const char *path
) {
  const pid_t child = fork();
  if (child == 0) {
    close(AGENT_LOCK_DESCRIPTOR);
    const AgentLockResultCode code = AgentLockI.acquire(path);
    _exit(
      code == AGENT_LOCK_RESULT_OK ? AGENT_LOCK_TEST_CHILD_ACQUIRED
      : code == AGENT_LOCK_ERROR_HELD ? AGENT_LOCK_TEST_CHILD_REFUSED
                                      : AGENT_LOCK_TEST_CHILD_FAILED
    );
  }
  int32_t status = 0;
  waitpid(child, &status, 0);
  return (AgentLockTestChildStatus)WEXITSTATUS(status);
}

static void agentLockRefusesASecondAgent(TestContext *context) {
  char path[AGENT_LOCK_TEST_PATH_CAPACITY];
  agentLockTestPath(path);

  EXPECT(context, AgentLockI.acquire(path) == AGENT_LOCK_RESULT_OK);
  EXPECT(
    context, agentLockTestAcquireAsOtherAgent(path) == AGENT_LOCK_TEST_CHILD_REFUSED
  );

  AgentLockI.release();
  unlink(path);
}

static void agentLockIsFreeOnceTheHolderIsGone(TestContext *context) {
  char path[AGENT_LOCK_TEST_PATH_CAPACITY];
  agentLockTestPath(path);

  EXPECT(context, AgentLockI.acquire(path) == AGENT_LOCK_RESULT_OK);
  AgentLockI.release();
  EXPECT(
    context, agentLockTestAcquireAsOtherAgent(path) == AGENT_LOCK_TEST_CHILD_ACQUIRED
  );

  unlink(path);
}

static void agentLockSurvivesARestart(TestContext *context) {
  char path[AGENT_LOCK_TEST_PATH_CAPACITY];
  agentLockTestPath(path);

  EXPECT(context, AgentLockI.acquire(path) == AGENT_LOCK_RESULT_OK);
  EXPECT(
    context,
    (fcntl(AGENT_LOCK_DESCRIPTOR, F_GETFD) & FD_CLOEXEC) != 0
  );

  EXPECT(context, AgentLockI.keepAcrossRestart() == AGENT_LOCK_RESULT_OK);
  EXPECT(
    context,
    (fcntl(AGENT_LOCK_DESCRIPTOR, F_GETFD) & FD_CLOEXEC) == 0
  );

  /** The new image finds the inherited descriptor and keeps the lock. */
  EXPECT(context, AgentLockI.acquire(path) == AGENT_LOCK_RESULT_OK);
  EXPECT(
    context,
    (fcntl(AGENT_LOCK_DESCRIPTOR, F_GETFD) & FD_CLOEXEC) != 0
  );
  EXPECT(
    context, agentLockTestAcquireAsOtherAgent(path) == AGENT_LOCK_TEST_CHILD_REFUSED
  );

  AgentLockI.release();
  unlink(path);
}

static void agentLockRejectsAForeignDescriptor(TestContext *context) {
  char path[AGENT_LOCK_TEST_PATH_CAPACITY];
  agentLockTestPath(path);

  const int32_t foreign = open("/dev/null", O_RDONLY);
  EXPECT(context, dup2(foreign, AGENT_LOCK_DESCRIPTOR) == AGENT_LOCK_DESCRIPTOR);
  close(foreign);

  EXPECT(
    context,
    AgentLockI.acquire(path) == AGENT_LOCK_ERROR_DESCRIPTOR_OCCUPIED
  );

  AgentLockI.release();
  unlink(path);
}

static void agentLockReportsAnUnopenableFile(TestContext *context) {
  EXPECT(
    context,
    AgentLockI.acquire("/nonexistent-directory/agent.lock")
      == AGENT_LOCK_ERROR_OPEN_FAILED
  );
}

static const TestCase AGENT_LOCK_TEST_CASES[] = {
  {"refuses a second agent", agentLockRefusesASecondAgent},
  {"is free once the holder is gone", agentLockIsFreeOnceTheHolderIsGone},
  {"survives a restart without being released", agentLockSurvivesARestart},
  {"rejects a foreign descriptor on the lock number", agentLockRejectsAForeignDescriptor},
  {"reports a lock file that cannot be opened", agentLockReportsAnUnopenableFile},
};

static const TestSuite AgentLockTestSuite = {
  .name      = "agent lock",
  .cases     = AGENT_LOCK_TEST_CASES,
  .caseCount = sizeof(AGENT_LOCK_TEST_CASES) / sizeof(AGENT_LOCK_TEST_CASES[0]),
};
