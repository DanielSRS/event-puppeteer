/**
 * @file command-executor.h
 * @brief Executes Commands that act on the Device's operating system.
 *
 * Only Commands that touch the host live here; `request_telemetry` is
 * answered by the agent itself because it is a network exchange.
 *
 * | Command    | Action                                   |
 * |------------|------------------------------------------|
 * | `restart`  | `systemctl reboot --no-block`            |
 * | `shutdown` | `systemctl poweroff --no-block`          |
 * | others     | `COMMAND_EXECUTION_UNSUPPORTED`          |
 *
 * `--no-block` makes systemd only *enqueue* the job, so the agent still has
 * a few seconds to report the outcome to Puppeteer before going down.
 *
 * The Puppet's user must be allowed to reboot and power off (e.g. through a
 * polkit rule, or by running as root); otherwise the Command fails and the
 * failure is reported.
 *
 * This default implementation targets systemd-based Linux. Other platforms
 * provide their own `command-executor.<platform>.c`.
 */
#ifndef PUPPET_COMMAND_EXECUTOR_H_
#define PUPPET_COMMAND_EXECUTOR_H_

#include "protocol/protocol.h"

typedef enum {
  COMMAND_EXECUTION_SUCCEEDED = 1,
  /** The action was attempted and failed. */
  COMMAND_EXECUTION_FAILED,
  /** This Puppet cannot perform this Command type. */
  COMMAND_EXECUTION_UNSUPPORTED,
} CommandExecutionResult;

struct CommandExecutorType {
  /** Perform a host-level Command. */
  CommandExecutionResult (*const execute)(const Command *command);
};

extern const struct CommandExecutorType CommandExecutorI;

#ifdef PUPPET_COMMAND_EXECUTOR_IMPLEMENTATION
#include "command-executor.c"
#endif

#endif // PUPPET_COMMAND_EXECUTOR_H_
