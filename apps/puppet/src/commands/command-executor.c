#include "command-executor.h"

#include <signal.h>
#include <spawn.h>
#include <sys/wait.h>

#define COMMAND_EXECUTOR_SYSTEMCTL "systemctl"

/** The process environment, required by posix_spawnp for the child. */
extern char **environ;

/**
 * Run a program and wait for it, with an unblocked signal mask: the agent
 * blocks termination signals (see `lifecycle.h`) and children inherit that.
 */
static CommandExecutionResult commandExecutorRun(char *const arguments[]) {
  sigset_t emptySignalMask;
  sigemptyset(&emptySignalMask);

  posix_spawnattr_t attributes;
  posix_spawnattr_init(&attributes);
  posix_spawnattr_setsigmask(&attributes, &emptySignalMask);
  posix_spawnattr_setflags(&attributes, POSIX_SPAWN_SETSIGMASK);

  pid_t         childProcess = 0;
  const int32_t spawnStatus  = posix_spawnp(
    &childProcess, arguments[0], NULL, &attributes, arguments, environ
  );
  posix_spawnattr_destroy(&attributes);
  if (spawnStatus != 0) {
    return COMMAND_EXECUTION_FAILED;
  }

  int32_t exitStatus = 0;
  if (waitpid(childProcess, &exitStatus, 0) != childProcess) {
    return COMMAND_EXECUTION_FAILED;
  }
  return WIFEXITED(exitStatus) && WEXITSTATUS(exitStatus) == 0
         ? COMMAND_EXECUTION_SUCCEEDED
         : COMMAND_EXECUTION_FAILED;
}

static CommandExecutionResult commandExecutorExecute(const Command *command) {
  /** posix_spawn takes mutable argument strings, hence stack copies. */
  char systemctl[]  = COMMAND_EXECUTOR_SYSTEMCTL;
  char noBlock[]    = "--no-block";
  char rebootVerb[] = "reboot";
  char powerVerb[]  = "poweroff";

  switch (command->type) {
  case COMMAND_TYPE_RESTART: {
    char *const arguments[] = {systemctl, rebootVerb, noBlock, NULL};
    return commandExecutorRun(arguments);
  }
  case COMMAND_TYPE_SHUTDOWN: {
    char *const arguments[] = {systemctl, powerVerb, noBlock, NULL};
    return commandExecutorRun(arguments);
  }
  case COMMAND_TYPE_UPDATE:
  case COMMAND_TYPE_OPEN_SSH:
  case COMMAND_TYPE_CUSTOM:
  case COMMAND_TYPE_REQUEST_TELEMETRY:
  case COMMAND_TYPE_UNKNOWN:
    break;
  }
  return COMMAND_EXECUTION_UNSUPPORTED;
}

const struct CommandExecutorType CommandExecutorI = {
  .execute = commandExecutorExecute,
};
