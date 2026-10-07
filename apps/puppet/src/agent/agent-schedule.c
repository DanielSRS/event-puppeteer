#include "agent-schedule.h"

#include <string.h>

/**
 * Doublings after which the backoff stops growing. 5 s << 6 = 320 s already
 * exceeds the cap, and bounding the shift keeps it well-defined.
 */
#define AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS ((uint32_t)6)

static AgentTaskSet agentSchedulePhaseTasks(const AgentSchedule *schedule) {
  switch (schedule->phase) {
  case AGENT_PHASE_UNENROLLED:
    return AGENT_TASK_CONNECT;
  case AGENT_PHASE_PENDING:
    return AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT;
  case AGENT_PHASE_ACTIVE: {
    const AgentTaskSet activeTasks =
      AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT | AGENT_TASK_POLL_COMMANDS;
    /** The feed is per Organization; without one there is nothing to fetch. */
    return schedule->hasOrganization ? activeTasks | AGENT_TASK_REFRESH_FEED
                                     : activeTasks;
  }
  case AGENT_PHASE_REJECTED:
    return AGENT_TASK_CHECK_STATUS;
  }
  return 0;
}

static uint64_t agentScheduleTaskDueAt(
  const AgentSchedule *schedule, const AgentTask task
) {
  switch (task) {
  case AGENT_TASK_CONNECT:
    return schedule->nextConnectAt;
  case AGENT_TASK_CHECK_STATUS:
    return schedule->nextStatusCheckAt;
  case AGENT_TASK_HEARTBEAT:
    return schedule->nextHeartbeatAt;
  case AGENT_TASK_POLL_COMMANDS:
    return schedule->nextCommandPollAt;
  case AGENT_TASK_REFRESH_FEED:
    return schedule->nextFeedRefreshAt;
  }
  return UINT64_MAX;
}

static const AgentTask AGENT_ALL_TASKS[] = {
  AGENT_TASK_CONNECT,
  AGENT_TASK_CHECK_STATUS,
  AGENT_TASK_HEARTBEAT,
  AGENT_TASK_POLL_COMMANDS,
  AGENT_TASK_REFRESH_FEED,
};

static uint64_t agentScheduleStatusInterval(const AgentPhase phase) {
  switch (phase) {
  case AGENT_PHASE_PENDING:
    return AGENT_PENDING_STATUS_INTERVAL_SECONDS;
  case AGENT_PHASE_REJECTED:
    return AGENT_REJECTED_STATUS_INTERVAL_SECONDS;
  case AGENT_PHASE_UNENROLLED:
  case AGENT_PHASE_ACTIVE:
    break;
  }
  return AGENT_ACTIVE_STATUS_INTERVAL_SECONDS;
}

static AgentSchedule agentScheduleCreate(
  const bool hasCredentials, const uint64_t now
) {
  return (AgentSchedule){
    .phase = hasCredentials ? AGENT_PHASE_PENDING : AGENT_PHASE_UNENROLLED,
    .nextConnectAt       = now,
    .nextStatusCheckAt   = now,
    .nextHeartbeatAt     = now,
    .nextCommandPollAt   = now,
    .nextFeedRefreshAt   = now,
    .connectFailureCount = 0,
    .hasOrganization     = false,
    .organizationId      = "",
  };
}

static AgentTaskSet agentScheduleDueTasks(
  const AgentSchedule *schedule, const uint64_t now
) {
  const AgentTaskSet phaseTasks = agentSchedulePhaseTasks(schedule);
  AgentTaskSet       dueTasks   = 0;
  const uint32_t     taskCount  = sizeof(AGENT_ALL_TASKS) / sizeof(AGENT_ALL_TASKS[0]);
  for (uint32_t index = 0; index < taskCount; index++) {
    const AgentTask task = AGENT_ALL_TASKS[index];
    if ((phaseTasks & (AgentTaskSet)task) != 0
        && agentScheduleTaskDueAt(schedule, task) <= now) {
      dueTasks |= (AgentTaskSet)task;
    }
  }
  return dueTasks;
}

static uint64_t agentScheduleSecondsUntilNextTask(
  const AgentSchedule *schedule, const uint64_t now
) {
  const AgentTaskSet phaseTasks = agentSchedulePhaseTasks(schedule);
  uint64_t           earliest   = UINT64_MAX;
  const uint32_t     taskCount  = sizeof(AGENT_ALL_TASKS) / sizeof(AGENT_ALL_TASKS[0]);
  for (uint32_t index = 0; index < taskCount; index++) {
    const AgentTask task = AGENT_ALL_TASKS[index];
    if ((phaseTasks & (AgentTaskSet)task) == 0) {
      continue;
    }
    const uint64_t dueAt = agentScheduleTaskDueAt(schedule, task);
    if (dueAt < earliest) {
      earliest = dueAt;
    }
  }
  return earliest > now ? earliest - now : 0;
}

static AgentSchedule agentScheduleConnected(
  const AgentSchedule *schedule, const uint64_t now
) {
  AgentSchedule next       = *schedule;
  next.phase               = AGENT_PHASE_PENDING;
  next.connectFailureCount = 0;
  next.nextStatusCheckAt   = now;
  next.nextHeartbeatAt     = now;
  return next;
}

static AgentSchedule agentScheduleConnectFailed(
  const AgentSchedule *schedule, const uint64_t now, const uint32_t randomValue
) {
  const uint32_t doublings =
    schedule->connectFailureCount < AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS
      ? schedule->connectFailureCount
      : AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS;
  const uint64_t backoff = AGENT_CONNECT_BACKOFF_BASE_SECONDS << doublings;
  const uint64_t delay   = backoff < AGENT_CONNECT_BACKOFF_MAX_SECONDS
                           ? backoff
                           : AGENT_CONNECT_BACKOFF_MAX_SECONDS;

  /** Up to +50% jitter so a fleet does not retry in lockstep. */
  const uint64_t jitter = (uint64_t)randomValue % (delay / 2 + 1);

  AgentSchedule next = *schedule;
  next.nextConnectAt = now + delay + jitter;
  next.connectFailureCount++;
  return next;
}

static AgentPhase agentSchedulePhaseOf(const DeviceStatus status) {
  switch (status) {
  case DEVICE_STATUS_PENDING:
    return AGENT_PHASE_PENDING;
  case DEVICE_STATUS_REJECTED:
    return AGENT_PHASE_REJECTED;
  case DEVICE_STATUS_ACTIVE:
  case DEVICE_STATUS_OFFLINE:
    break;
  }
  /** "offline" is Puppeteer's view of a silent approved Device; from the
   *  Device's own perspective it is still approved and must keep working. */
  return AGENT_PHASE_ACTIVE;
}

static AgentSchedule agentScheduleDeviceStateReceived(
  const AgentSchedule *schedule, const DeviceState *state, const uint64_t now
) {
  AgentSchedule next = *schedule;
  next.phase         = agentSchedulePhaseOf(state->status);

  const bool becameActive = next.phase == AGENT_PHASE_ACTIVE
                         && schedule->phase != AGENT_PHASE_ACTIVE;
  const bool organizationChanged =
    state->hasOrganization != schedule->hasOrganization
    || strcmp(state->organizationId, schedule->organizationId) != 0;

  next.hasOrganization = state->hasOrganization;
  memcpy(next.organizationId, state->organizationId, sizeof(next.organizationId));

  next.nextStatusCheckAt = now + agentScheduleStatusInterval(next.phase);
  if (becameActive) {
    next.nextCommandPollAt = now;
  }
  if (becameActive || organizationChanged) {
    next.nextFeedRefreshAt = now;
  }
  return next;
}

static AgentSchedule agentScheduleCredentialsRevoked(
  const AgentSchedule *schedule, const uint64_t now
) {
  AgentSchedule next       = *schedule;
  next.phase               = AGENT_PHASE_UNENROLLED;
  next.nextConnectAt       = now;
  next.connectFailureCount = 0;
  next.hasOrganization     = false;
  next.organizationId[0]   = '\0';
  return next;
}

static AgentSchedule agentScheduleTaskFinished(
  const AgentSchedule *schedule,
  const AgentTask      task,
  const bool           succeeded,
  const uint64_t       now
) {
  AgentSchedule next = *schedule;
  switch (task) {
  case AGENT_TASK_CHECK_STATUS:
    next.nextStatusCheckAt = now + agentScheduleStatusInterval(next.phase);
    break;
  case AGENT_TASK_HEARTBEAT:
    next.nextHeartbeatAt = now + AGENT_HEARTBEAT_INTERVAL_SECONDS;
    break;
  case AGENT_TASK_POLL_COMMANDS:
    next.nextCommandPollAt = now + AGENT_COMMAND_POLL_INTERVAL_SECONDS;
    break;
  case AGENT_TASK_REFRESH_FEED:
    next.nextFeedRefreshAt = now
                           + (succeeded ? AGENT_FEED_REFRESH_INTERVAL_SECONDS
                                        : AGENT_FEED_RETRY_INTERVAL_SECONDS);
    break;
  case AGENT_TASK_CONNECT:
    /** Connect outcomes carry more information; see `connected` and
     *  `connectFailed`. */
    break;
  }
  return next;
}

const struct AgentScheduleType AgentScheduleI = {
  .create               = agentScheduleCreate,
  .dueTasks             = agentScheduleDueTasks,
  .secondsUntilNextTask = agentScheduleSecondsUntilNextTask,
  .connected            = agentScheduleConnected,
  .connectFailed        = agentScheduleConnectFailed,
  .deviceStateReceived  = agentScheduleDeviceStateReceived,
  .credentialsRevoked   = agentScheduleCredentialsRevoked,
  .taskFinished         = agentScheduleTaskFinished,
};
