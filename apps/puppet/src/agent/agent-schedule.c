#include "agent-schedule.h"

#include <string.h>

/**
 * Doublings after which the backoff stops growing. 5 s << 6 = 320 s already
 * exceeds the cap, and bounding the shift keeps it well-defined.
 */
#define AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS ((uint32_t)6)

/** Whether the Device is active in an Organization, the only time Wake-ups matter. */
static bool agentScheduleListensForWakeups(const AgentSchedule *schedule) {
  return schedule->phase == AGENT_PHASE_ACTIVE && schedule->hasOrganization;
}

static bool agentScheduleBrokerTopicIsStale(const AgentSchedule *schedule) {
  return strcmp(schedule->brokerOrganizationId, schedule->organizationId) != 0;
}

/**
 * Whether the broker connection must be closed or moved, or has run out of
 * time, whatever the clock says; `NONE` otherwise.
 */
static AgentBrokerAction agentScheduleBrokerAction(
  const AgentSchedule *schedule, const uint64_t now
) {
  if (schedule->brokerState == AGENT_BROKER_DISCONNECTED) {
    return AGENT_BROKER_ACTION_NONE;
  }
  if (!agentScheduleListensForWakeups(schedule)) {
    return AGENT_BROKER_ACTION_DROP;
  }
  if (agentScheduleBrokerTopicIsStale(schedule)) {
    return AGENT_BROKER_ACTION_RESUBSCRIBE;
  }
  if (schedule->brokerState == AGENT_BROKER_CONNECTING
      && schedule->nextBrokerAttemptAt <= now) {
    return AGENT_BROKER_ACTION_TIME_OUT;
  }
  return AGENT_BROKER_ACTION_NONE;
}

static AgentTaskSet agentSchedulePhaseTasks(const AgentSchedule *schedule) {
  switch (schedule->phase) {
  case AGENT_PHASE_UNENROLLED:
    return AGENT_TASK_CONNECT;
  case AGENT_PHASE_PENDING:
    return AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT;
  case AGENT_PHASE_ACTIVE: {
    const AgentTaskSet activeTasks =
      AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT | AGENT_TASK_FETCH_COMMANDS;
    /** The feed is per Organization; without one there is nothing to fetch. */
    return schedule->hasOrganization ? activeTasks | AGENT_TASK_REFRESH_FEED
                                     : activeTasks;
  }
  case AGENT_PHASE_REJECTED:
    return AGENT_TASK_CHECK_STATUS;
  }
  return 0;
}

/** Phase tasks plus the broker tasks, which also depend on the connection. */
static AgentTaskSet agentScheduleApplicableTasks(const AgentSchedule *schedule) {
  AgentTaskSet tasks = agentSchedulePhaseTasks(schedule);
  if (agentScheduleListensForWakeups(schedule)
      && schedule->brokerState == AGENT_BROKER_DISCONNECTED) {
    tasks |= AGENT_TASK_CONNECT_BROKER;
  }
  if (schedule->brokerState != AGENT_BROKER_DISCONNECTED) {
    tasks |= AGENT_TASK_SYNC_BROKER;
  }
  return tasks;
}

/**
 * Time at which the connection needs attention: now when it must be closed
 * or moved, otherwise the handshake deadline.
 */
static uint64_t agentScheduleBrokerSyncDueAt(const AgentSchedule *schedule) {
  const bool mustChange = !agentScheduleListensForWakeups(schedule)
                       || agentScheduleBrokerTopicIsStale(schedule);
  if (mustChange) {
    return 0;
  }
  return schedule->brokerState == AGENT_BROKER_CONNECTING
         ? schedule->nextBrokerAttemptAt
         : AGENT_NEVER_DUE;
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
  case AGENT_TASK_FETCH_COMMANDS:
    return schedule->nextCommandFetchAt;
  case AGENT_TASK_REFRESH_FEED:
    return schedule->nextFeedRefreshAt;
  case AGENT_TASK_CONNECT_BROKER:
    return schedule->nextBrokerAttemptAt;
  case AGENT_TASK_SYNC_BROKER:
    return agentScheduleBrokerSyncDueAt(schedule);
  }
  return UINT64_MAX;
}

static const AgentTask AGENT_ALL_TASKS[] = {
  AGENT_TASK_CONNECT,
  AGENT_TASK_CHECK_STATUS,
  AGENT_TASK_HEARTBEAT,
  AGENT_TASK_FETCH_COMMANDS,
  AGENT_TASK_REFRESH_FEED,
  AGENT_TASK_CONNECT_BROKER,
  AGENT_TASK_SYNC_BROKER,
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
    .nextCommandFetchAt   = now,
    .nextFeedRefreshAt   = now,
    .brokerState         = AGENT_BROKER_DISCONNECTED,
    .nextBrokerAttemptAt = now,
    .brokerFailureCount  = 0,
    .brokerOrganizationId = "",
    .connectFailureCount = 0,
    .hasOrganization     = false,
    .organizationId      = "",
  };
}

static AgentTaskSet agentScheduleDueTasks(
  const AgentSchedule *schedule, const uint64_t now
) {
  const AgentTaskSet phaseTasks = agentScheduleApplicableTasks(schedule);
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
  const AgentTaskSet phaseTasks = agentScheduleApplicableTasks(schedule);
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

/**
 * Delay before retry number `failureCount + 1`: `base` doubled per failure up
 * to `maximum`, plus up to +50% jitter so a fleet does not retry in lockstep.
 */
static uint64_t agentScheduleBackoffDelay(
  const uint32_t failureCount,
  const uint64_t base,
  const uint64_t maximum,
  const uint32_t randomValue
) {
  const uint32_t doublings = failureCount < AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS
                             ? failureCount
                             : AGENT_CONNECT_BACKOFF_MAX_DOUBLINGS;
  const uint64_t backoff = base << doublings;
  const uint64_t delay   = backoff < maximum ? backoff : maximum;
  const uint64_t jitter  = (uint64_t)randomValue % (delay / 2 + 1);
  return delay + jitter;
}

static AgentSchedule agentScheduleConnectFailed(
  const AgentSchedule *schedule, const uint64_t now, const uint32_t randomValue
) {
  AgentSchedule next = *schedule;
  next.nextConnectAt = now
                     + agentScheduleBackoffDelay(
                         schedule->connectFailureCount,
                         AGENT_CONNECT_BACKOFF_BASE_SECONDS,
                         AGENT_CONNECT_BACKOFF_MAX_SECONDS,
                         randomValue
                       );
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
    next.nextCommandFetchAt = now;
  }
  if (becameActive || organizationChanged) {
    next.nextFeedRefreshAt = now;
  }
  return next;
}

static AgentSchedule agentScheduleHeartbeatAnswered(
  const AgentSchedule *schedule, const bool commandsWaiting, const uint64_t now
) {
  AgentSchedule next = *schedule;
  if (commandsWaiting && schedule->phase == AGENT_PHASE_ACTIVE) {
    next.nextCommandFetchAt = now;
  }
  return next;
}

static AgentSchedule agentScheduleWakeupHeard(
  const AgentSchedule *schedule, const uint64_t now
) {
  AgentSchedule next = *schedule;
  if (schedule->phase == AGENT_PHASE_ACTIVE) {
    next.nextCommandFetchAt = now;
  }
  return next;
}

static AgentSchedule agentScheduleBrokerBackedOff(
  const AgentSchedule *schedule, const uint64_t now, const uint32_t randomValue
) {
  AgentSchedule next        = *schedule;
  next.brokerState          = AGENT_BROKER_DISCONNECTED;
  next.nextBrokerAttemptAt  = now
                            + agentScheduleBackoffDelay(
                                schedule->brokerFailureCount,
                                AGENT_BROKER_BACKOFF_BASE_SECONDS,
                                AGENT_BROKER_BACKOFF_MAX_SECONDS,
                                randomValue
                              );
  next.brokerFailureCount++;
  return next;
}

static AgentSchedule agentScheduleBrokerConnectFinished(
  const AgentSchedule *schedule,
  const bool           succeeded,
  const uint64_t       now,
  const uint32_t       randomValue
) {
  if (!succeeded) {
    return agentScheduleBrokerBackedOff(schedule, now, randomValue);
  }
  AgentSchedule next       = *schedule;
  next.brokerState         = AGENT_BROKER_CONNECTING;
  next.nextBrokerAttemptAt = now + AGENT_BROKER_HANDSHAKE_TIMEOUT_SECONDS;
  memcpy(
    next.brokerOrganizationId,
    schedule->organizationId,
    sizeof(next.brokerOrganizationId)
  );
  return next;
}

static AgentSchedule agentScheduleBrokerSubscribed(
  const AgentSchedule *schedule, const uint64_t now
) {
  AgentSchedule next      = *schedule;
  next.brokerState        = AGENT_BROKER_SUBSCRIBED;
  next.brokerFailureCount = 0;
  if (schedule->phase == AGENT_PHASE_ACTIVE) {
    next.nextCommandFetchAt = now;
  }
  return next;
}

static AgentSchedule agentScheduleBrokerLost(
  const AgentSchedule *schedule, const uint64_t now, const uint32_t randomValue
) {
  return agentScheduleBrokerBackedOff(schedule, now, randomValue);
}

static AgentSchedule agentScheduleBrokerDropped(
  const AgentSchedule *schedule, const uint64_t now
) {
  AgentSchedule next            = *schedule;
  next.brokerState              = AGENT_BROKER_DISCONNECTED;
  next.nextBrokerAttemptAt      = now;
  next.brokerFailureCount       = 0;
  next.brokerOrganizationId[0]  = '\0';
  return next;
}

static AgentSchedule agentScheduleBrokerRetargeted(
  const AgentSchedule *schedule, const uint64_t now
) {
  return agentScheduleBrokerConnectFinished(schedule, true, now, 0);
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
  case AGENT_TASK_FETCH_COMMANDS:
    next.nextCommandFetchAt = AGENT_NEVER_DUE;
    break;
  case AGENT_TASK_REFRESH_FEED:
    next.nextFeedRefreshAt = now
                           + (succeeded ? AGENT_FEED_REFRESH_INTERVAL_SECONDS
                                        : AGENT_FEED_RETRY_INTERVAL_SECONDS);
    break;
  case AGENT_TASK_CONNECT:
  case AGENT_TASK_CONNECT_BROKER:
  case AGENT_TASK_SYNC_BROKER:
    /** These outcomes carry more information; see `connected`,
     *  `connectFailed` and the `broker*` events. */
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
  .heartbeatAnswered    = agentScheduleHeartbeatAnswered,
  .wakeupHeard          = agentScheduleWakeupHeard,
  .brokerConnectFinished = agentScheduleBrokerConnectFinished,
  .brokerSubscribed     = agentScheduleBrokerSubscribed,
  .brokerLost           = agentScheduleBrokerLost,
  .brokerDropped        = agentScheduleBrokerDropped,
  .brokerRetargeted     = agentScheduleBrokerRetargeted,
  .brokerAction         = agentScheduleBrokerAction,
  .credentialsRevoked   = agentScheduleCredentialsRevoked,
  .taskFinished         = agentScheduleTaskFinished,
};
