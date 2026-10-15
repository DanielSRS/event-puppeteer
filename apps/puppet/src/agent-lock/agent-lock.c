#include "agent-lock.h"

#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>

/** Only root runs the agent; nobody else has a reason to touch the lock. */
#define AGENT_LOCK_FILE_MODE ((mode_t)0600)

/** `F_SETFD` flags with close-on-exec cleared: the descriptor survives `execv`. */
#define AGENT_LOCK_CLOSE_ON_EXEC_OFF 0

static bool agentLockIsOpen(const int32_t descriptor) {
  return fcntl(descriptor, F_GETFD) != -1;
}

/** Whether `descriptor` and `path` name the same file. */
static bool agentLockRefersTo(const int32_t descriptor, const char *path) {
  struct stat opened;
  struct stat named;
  if (fstat(descriptor, &opened) != 0 || stat(path, &named) != 0) {
    return false;
  }
  return opened.st_dev == named.st_dev && opened.st_ino == named.st_ino;
}

static AgentLockResultCode agentLockTake(const int32_t descriptor) {
  if (flock(descriptor, LOCK_EX | LOCK_NB) == 0) {
    return AGENT_LOCK_RESULT_OK;
  }
  return errno == EWOULDBLOCK ? AGENT_LOCK_ERROR_HELD
                              : AGENT_LOCK_ERROR_LOCK_FAILED;
}

static AgentLockResultCode agentLockAcquire(const char *path) {
  /** Set by the previous image of a self-update restart. */
  if (agentLockIsOpen(AGENT_LOCK_DESCRIPTOR)) {
    if (!agentLockRefersTo(AGENT_LOCK_DESCRIPTOR, path)) {
      return AGENT_LOCK_ERROR_DESCRIPTOR_OCCUPIED;
    }
    /**
     * Inheritable only for the exec that brought us here: from now on spawned
     * Commands must not keep the lock alive after the agent dies.
     */
    if (fcntl(AGENT_LOCK_DESCRIPTOR, F_SETFD, FD_CLOEXEC) != 0) {
      return AGENT_LOCK_ERROR_PLACEMENT_FAILED;
    }
    return agentLockTake(AGENT_LOCK_DESCRIPTOR);
  }

  const int32_t opened = open(path, O_RDWR | O_CREAT | O_CLOEXEC, AGENT_LOCK_FILE_MODE);
  if (opened < 0) {
    return AGENT_LOCK_ERROR_OPEN_FAILED;
  }
  const AgentLockResultCode taken = agentLockTake(opened);
  if (taken != AGENT_LOCK_RESULT_OK) {
    close(opened);
    return taken;
  }

  /**
   * The duplicate shares the open file description, so it shares the lock.
   * The agent is still single-threaded here, so the window between `dup2`
   * and `fcntl` cannot leak the descriptor to a child.
   */
  const int32_t placed = dup2(opened, AGENT_LOCK_DESCRIPTOR);
  close(opened);
  if (placed != AGENT_LOCK_DESCRIPTOR
      || fcntl(AGENT_LOCK_DESCRIPTOR, F_SETFD, FD_CLOEXEC) != 0) {
    return AGENT_LOCK_ERROR_PLACEMENT_FAILED;
  }
  return AGENT_LOCK_RESULT_OK;
}

static AgentLockResultCode agentLockKeepAcrossRestart(void) {
  return fcntl(AGENT_LOCK_DESCRIPTOR, F_SETFD, AGENT_LOCK_CLOSE_ON_EXEC_OFF) == 0
         ? AGENT_LOCK_RESULT_OK
         : AGENT_LOCK_ERROR_RESTART_PREPARATION_FAILED;
}

static void agentLockRelease(void) {
  close(AGENT_LOCK_DESCRIPTOR);
}

const struct AgentLockType AgentLockI = {
  .acquire             = agentLockAcquire,
  .keepAcrossRestart   = agentLockKeepAcrossRestart,
  .release             = agentLockRelease,
};
