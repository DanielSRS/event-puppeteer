#include "agent.h"

#include "agent/agent-schedule.h"
#include "commands/command-executor.h"
#include "device-store/device-store.h"
#include "protocol/protocol.h"
#include "stats/stats.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/** Room for the largest request body (detailed Telemetry). */
#define AGENT_REQUEST_BODY_CAPACITY ((size_t)4096)

#define AGENT_PATH_CAPACITY ((size_t)256)

#define AGENT_AUTHORIZATION_PREFIX "Authorization: Bearer "
#define AGENT_AUTHORIZATION_HEADER_CAPACITY                                    \
  (sizeof(AGENT_AUTHORIZATION_PREFIX) + PROTOCOL_DEVICE_TOKEN_CAPACITY)

/** Log lines kept for Puppeteer while it is unreachable; oldest drop first. */
#define AGENT_LOG_QUEUE_CAPACITY ((uint32_t)16)
#define AGENT_LOG_MESSAGE_CAPACITY ((size_t)256)

/**
 * Upper bound on a single sleep. The schedule already knows when the next
 * task is due; this only guards against clock or arithmetic surprises.
 */
#define AGENT_MAX_SLEEP_SECONDS ((uint64_t)60)

/** Polling for termination without sleeping. */
#define AGENT_NO_WAIT_SECONDS ((uint64_t)0)

#define AGENT_HTTP_STATUS_SUCCESS_FIRST ((int32_t)200)
#define AGENT_HTTP_STATUS_SUCCESS_LAST  ((int32_t)299)
#define AGENT_HTTP_STATUS_UNAUTHORIZED  ((int32_t)401)

/** Ack takes no input, but Puppeteer's POST routes expect a JSON body. */
#define AGENT_EMPTY_JSON_BODY "{}"

typedef enum {
  AGENT_LOG_LEVEL_INFO = 1,
  AGENT_LOG_LEVEL_WARNING,
  AGENT_LOG_LEVEL_ERROR,
} AgentLogLevel;

typedef struct {
  AgentLogLevel level;
  char          message[AGENT_LOG_MESSAGE_CAPACITY];
} AgentLogEntry;

/** Ring buffer of log lines waiting to be shipped to Puppeteer. */
typedef struct {
  AgentLogEntry entries[AGENT_LOG_QUEUE_CAPACITY];
  uint32_t      first;
  uint32_t      count;
} AgentLogQueue;

typedef enum {
  AGENT_EXCHANGE_SUCCEEDED = 1,
  /** Puppeteer no longer accepts this Device's credentials. */
  AGENT_EXCHANGE_UNAUTHORIZED,
  /** Network failure, server error or unexpected response. */
  AGENT_EXCHANGE_FAILED,
} AgentExchangeOutcome;

/** Mutable state of one `run`. Lives on its stack frame and never moves. */
typedef struct {
  const AgentEnvironment *environment;
  AgentSchedule           schedule;

  bool              hasCredentials;
  DeviceCredentials credentials;
  char              authorizationHeader[AGENT_AUTHORIZATION_HEADER_CAPACITY];

  /** Points into `authorizationHeader`. */
  HttpExtraHeaders authorization;

  AgentLogQueue logs;

  /** Events in the last stored feed, to log only when it changes. */
  uint32_t lastFeedEventCount;
} AgentRuntime;

static const char *agentLogLevelName(const AgentLogLevel level) {
  switch (level) {
  case AGENT_LOG_LEVEL_INFO:
    return "info";
  case AGENT_LOG_LEVEL_WARNING:
    return "warning";
  case AGENT_LOG_LEVEL_ERROR:
    break;
  }
  return "error";
}

static void agentQueueLog(
  AgentLogQueue *queue, const AgentLogLevel level, const char *message
) {
  if (queue->count == AGENT_LOG_QUEUE_CAPACITY) {
    queue->first = (queue->first + 1) % AGENT_LOG_QUEUE_CAPACITY;
    queue->count--;
  }
  AgentLogEntry *entry =
    &queue->entries[(queue->first + queue->count) % AGENT_LOG_QUEUE_CAPACITY];
  entry->level = level;
  snprintf(entry->message, sizeof(entry->message), "%s", message);
  queue->count++;
}

/** Log to standard error (journald) and queue the line for Puppeteer. */
__attribute__((format(printf, 3, 4))) static void agentLog(
  AgentRuntime *runtime, const AgentLogLevel level, const char *format, ...
) {
  char    message[AGENT_LOG_MESSAGE_CAPACITY];
  va_list arguments;
  va_start(arguments, format);
  vsnprintf(message, sizeof(message), format, arguments);
  va_end(arguments);

  fprintf(stderr, "[%s] %s\n", agentLogLevelName(level), message);
  agentQueueLog(&runtime->logs, level, message);
}

static AgentExchangeOutcome agentClassify(const HttpResult *result) {
  if (result->code != HTTP_RESULT_OK) {
    return AGENT_EXCHANGE_FAILED;
  }
  if (result->httpStatus == AGENT_HTTP_STATUS_UNAUTHORIZED) {
    return AGENT_EXCHANGE_UNAUTHORIZED;
  }
  if (result->httpStatus < AGENT_HTTP_STATUS_SUCCESS_FIRST
      || result->httpStatus > AGENT_HTTP_STATUS_SUCCESS_LAST) {
    return AGENT_EXCHANGE_FAILED;
  }
  return AGENT_EXCHANGE_SUCCEEDED;
}

/** Log why an exchange with Puppeteer failed. */
static void agentLogFailure(
  AgentRuntime *runtime, const char *action, const HttpResult *result
) {
  if (result->code == HTTP_RESULT_ERROR) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "%s failed: network error (curl code %d)",
      action,
      result->curlCode
    );
  } else if (result->code == HTTP_RESULT_BODY_TRUNCATED) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "%s failed: response exceeded %zu bytes",
      action,
      (size_t)HTTP_RESPONSE_BUFFER_CAPACITY
    );
  } else {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "%s failed: HTTP %d",
      action,
      result->httpStatus
    );
  }
}

static void agentSetCredentials(
  AgentRuntime *runtime, const DeviceCredentials *credentials
) {
  runtime->credentials    = *credentials;
  runtime->hasCredentials = true;
  snprintf(
    runtime->authorizationHeader,
    sizeof(runtime->authorizationHeader),
    AGENT_AUTHORIZATION_PREFIX "%s",
    credentials->token
  );
  runtime->authorization = (HttpExtraHeaders){
    .headers = {runtime->authorizationHeader},
    .count   = 1,
  };
}

static void agentRevokeCredentials(AgentRuntime *runtime, const uint64_t now) {
  agentLog(
    runtime,
    AGENT_LOG_LEVEL_WARNING,
    "Puppeteer rejected the credentials of device %s; enrolling again",
    runtime->credentials.deviceId
  );
  DeviceStoreI.clearCredentials(runtime->environment->storage);
  runtime->hasCredentials = false;
  runtime->schedule = AgentScheduleI.credentialsRevoked(&runtime->schedule, now);
}

static HttpResult agentGet(AgentRuntime *runtime, const char *path) {
  return HttpClientI.get(
    runtime->environment->httpClient, path, &runtime->authorization
  );
}

static HttpResult
agentPost(AgentRuntime *runtime, const char *path, const char *body) {
  return HttpClientI.post(
    runtime->environment->httpClient, path, body, &runtime->authorization
  );
}

static void agentConnect(AgentRuntime *runtime, const uint64_t now) {
  const PuppetConfig *config = runtime->environment->config;
  char                body[AGENT_REQUEST_BODY_CAPACITY];
  const ProtocolResultCode written = ProtocolI.writeConnectRequest(
    config->deviceIdentifier,
    config->hasOrganization ? config->organizationId : NULL,
    (RequestBody){.buffer = body, .capacity = sizeof(body)}
  );

  /** Connect is the only unauthenticated device call. */
  const HttpResult result =
    written == PROTOCOL_RESULT_OK
      ? HttpClientI.post(
          runtime->environment->httpClient, "/devices/connect", body, NULL
        )
      : (HttpResult){.code = HTTP_RESULT_ERROR, .curlCode = (int32_t)written};

  DeviceCredentials credentials;
  if (agentClassify(&result) != AGENT_EXCHANGE_SUCCEEDED
      || ProtocolI.readConnectResponse(result.body, result.bodyLength, &credentials)
           != PROTOCOL_RESULT_OK) {
    agentLogFailure(runtime, "connecting to Puppeteer", &result);
    runtime->schedule = AgentScheduleI.connectFailed(
      &runtime->schedule, now, LifecycleI.randomValue()
    );
    return;
  }

  if (!DeviceStoreI.saveCredentials(runtime->environment->storage, &credentials)) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "could not persist credentials; they will be lost on restart"
    );
  }
  agentSetCredentials(runtime, &credentials);
  runtime->schedule = AgentScheduleI.connected(&runtime->schedule, now);
  agentLog(
    runtime,
    AGENT_LOG_LEVEL_INFO,
    "connected as device %s; waiting for approval",
    credentials.deviceId
  );
}

static void agentLogPhaseChange(AgentRuntime *runtime, const DeviceState *state) {
  switch (runtime->schedule.phase) {
  case AGENT_PHASE_PENDING:
    agentLog(runtime, AGENT_LOG_LEVEL_INFO, "waiting for approval");
    break;
  case AGENT_PHASE_ACTIVE:
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_INFO,
      "approved as \"%s\" in organization %s",
      state->name,
      state->hasOrganization ? state->organizationId : "(none)"
    );
    break;
  case AGENT_PHASE_REJECTED:
    agentLog(runtime, AGENT_LOG_LEVEL_WARNING, "enrollment was rejected");
    break;
  case AGENT_PHASE_UNENROLLED:
    break;
  }
}

static void agentCheckStatus(AgentRuntime *runtime, const uint64_t now) {
  const HttpResult           result  = agentGet(runtime, "/devices/me");
  const AgentExchangeOutcome outcome = agentClassify(&result);
  if (outcome == AGENT_EXCHANGE_UNAUTHORIZED) {
    agentRevokeCredentials(runtime, now);
    return;
  }

  DeviceState state;
  if (outcome != AGENT_EXCHANGE_SUCCEEDED
      || ProtocolI.readDeviceState(result.body, result.bodyLength, &state)
           != PROTOCOL_RESULT_OK) {
    agentLogFailure(runtime, "checking device status", &result);
    runtime->schedule = AgentScheduleI.taskFinished(
      &runtime->schedule, AGENT_TASK_CHECK_STATUS, false, now
    );
    return;
  }

  const AgentPhase previousPhase = runtime->schedule.phase;
  runtime->schedule =
    AgentScheduleI.deviceStateReceived(&runtime->schedule, &state, now);
  if (runtime->schedule.phase != previousPhase) {
    agentLogPhaseChange(runtime, &state);
  }
}

/** Ship queued log lines, stopping at the first failure to retry later. */
static void agentFlushLogs(AgentRuntime *runtime) {
  char path[AGENT_PATH_CAPACITY];
  snprintf(path, sizeof(path), "/devices/%s/logs", runtime->credentials.deviceId);

  AgentLogQueue *queue = &runtime->logs;
  while (queue->count > 0) {
    const AgentLogEntry *entry = &queue->entries[queue->first];
    char                 body[AGENT_REQUEST_BODY_CAPACITY];
    const ProtocolResultCode written = ProtocolI.writeLogRequest(
      agentLogLevelName(entry->level),
      entry->message,
      (RequestBody){.buffer = body, .capacity = sizeof(body)}
    );
    if (written == PROTOCOL_RESULT_OK) {
      const HttpResult result = agentPost(runtime, path, body);
      if (agentClassify(&result) != AGENT_EXCHANGE_SUCCEEDED) {
        return;
      }
    }
    queue->first = (queue->first + 1) % AGENT_LOG_QUEUE_CAPACITY;
    queue->count--;
  }
}

static void agentHeartbeat(AgentRuntime *runtime, const uint64_t now) {
  const char    *errors[AGENT_LOG_QUEUE_CAPACITY];
  uint32_t       errorCount = 0;
  AgentLogQueue *queue      = &runtime->logs;
  for (uint32_t offset = 0; offset < queue->count; offset++) {
    const AgentLogEntry *entry =
      &queue->entries[(queue->first + offset) % AGENT_LOG_QUEUE_CAPACITY];
    if (entry->level == AGENT_LOG_LEVEL_ERROR) {
      errors[errorCount] = entry->message;
      errorCount++;
    }
  }

  char path[AGENT_PATH_CAPACITY];
  snprintf(
    path, sizeof(path), "/devices/%s/heartbeat", runtime->credentials.deviceId
  );
  char                     body[AGENT_REQUEST_BODY_CAPACITY];
  const ProtocolResultCode written = ProtocolI.writeHeartbeatRequest(
    errorCount == 0 ? "ok" : "degraded",
    errors,
    errorCount,
    (RequestBody){.buffer = body, .capacity = sizeof(body)}
  );
  if (written != PROTOCOL_RESULT_OK) {
    /** Too many long errors to fit: a bare heartbeat still proves liveness;
     *  the errors themselves reach Puppeteer through the logs. */
    ProtocolI.writeHeartbeatRequest(
      "degraded", NULL, 0, (RequestBody){.buffer = body, .capacity = sizeof(body)}
    );
  }

  const HttpResult           result  = agentPost(runtime, path, body);
  const AgentExchangeOutcome outcome = agentClassify(&result);
  if (outcome == AGENT_EXCHANGE_UNAUTHORIZED) {
    agentRevokeCredentials(runtime, now);
    return;
  }
  const bool succeeded = outcome == AGENT_EXCHANGE_SUCCEEDED;
  if (succeeded) {
    agentFlushLogs(runtime);
  } else {
    agentLogFailure(runtime, "sending heartbeat", &result);
  }
  runtime->schedule = AgentScheduleI.taskFinished(
    &runtime->schedule, AGENT_TASK_HEARTBEAT, succeeded, now
  );
}

static bool agentSendTelemetry(AgentRuntime *runtime) {
  const StatsSnapshot   stats  = StatsI.getSnapshot();
  const TelemetryReport report = {
    .stats           = &stats,
    .puppetVersion   = runtime->environment->puppetVersion,
    .puppetStartTime = runtime->environment->puppetStartTime,
  };
  char                     body[AGENT_REQUEST_BODY_CAPACITY];
  const ProtocolResultCode written = ProtocolI.writeTelemetryRequest(
    &report, (RequestBody){.buffer = body, .capacity = sizeof(body)}
  );
  if (written != PROTOCOL_RESULT_OK) {
    agentLog(
      runtime, AGENT_LOG_LEVEL_ERROR, "telemetry report too large (%d)", written
    );
    return false;
  }

  char path[AGENT_PATH_CAPACITY];
  snprintf(
    path, sizeof(path), "/devices/%s/telemetry", runtime->credentials.deviceId
  );
  const HttpResult result = agentPost(runtime, path, body);
  if (agentClassify(&result) != AGENT_EXCHANGE_SUCCEEDED) {
    agentLogFailure(runtime, "sending telemetry", &result);
    return false;
  }
  return true;
}

static const char *agentCommandTypeName(const CommandType type) {
  switch (type) {
  case COMMAND_TYPE_RESTART:
    return "restart";
  case COMMAND_TYPE_SHUTDOWN:
    return "shutdown";
  case COMMAND_TYPE_UPDATE:
    return "update";
  case COMMAND_TYPE_OPEN_SSH:
    return "open_ssh";
  case COMMAND_TYPE_CUSTOM:
    return "custom";
  case COMMAND_TYPE_REQUEST_TELEMETRY:
    return "request_telemetry";
  case COMMAND_TYPE_UNKNOWN:
    break;
  }
  return "unknown";
}

static bool agentExecute(AgentRuntime *runtime, const Command *command) {
  if (command->type == COMMAND_TYPE_REQUEST_TELEMETRY) {
    return agentSendTelemetry(runtime);
  }
  const CommandExecutionResult result = CommandExecutorI.execute(command);
  if (result == COMMAND_EXECUTION_UNSUPPORTED) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_WARNING,
      "command %s (%s) is not supported by this Puppet",
      command->id,
      agentCommandTypeName(command->type)
    );
  }
  return result == COMMAND_EXECUTION_SUCCEEDED;
}

static void agentRunCommand(AgentRuntime *runtime, const Command *command) {
  const char *deviceId = runtime->credentials.deviceId;
  char        path[AGENT_PATH_CAPACITY];

  snprintf(
    path, sizeof(path), "/devices/%s/commands/%s/ack", deviceId, command->id
  );
  const HttpResult acknowledgement =
    agentPost(runtime, path, AGENT_EMPTY_JSON_BODY);
  if (agentClassify(&acknowledgement) != AGENT_EXCHANGE_SUCCEEDED) {
    /** Puppeteer already handed the Command over; executing it and
     *  reporting completion is still the most useful outcome. */
    agentLogFailure(runtime, "acknowledging command", &acknowledgement);
  }

  const bool succeeded = agentExecute(runtime, command);

  char body[AGENT_REQUEST_BODY_CAPACITY];
  ProtocolI.writeCommandCompletion(
    succeeded, (RequestBody){.buffer = body, .capacity = sizeof(body)}
  );
  snprintf(
    path, sizeof(path), "/devices/%s/commands/%s/complete", deviceId, command->id
  );
  const HttpResult completion = agentPost(runtime, path, body);
  if (agentClassify(&completion) != AGENT_EXCHANGE_SUCCEEDED) {
    agentLogFailure(runtime, "reporting command completion", &completion);
  }
  agentLog(
    runtime,
    succeeded ? AGENT_LOG_LEVEL_INFO : AGENT_LOG_LEVEL_ERROR,
    "command %s (%s) %s",
    command->id,
    agentCommandTypeName(command->type),
    succeeded ? "succeeded" : "failed"
  );
}

static void agentPollCommands(AgentRuntime *runtime, const uint64_t now) {
  char path[AGENT_PATH_CAPACITY];
  snprintf(
    path,
    sizeof(path),
    "/devices/%s/commands/pending",
    runtime->credentials.deviceId
  );
  const HttpResult           result  = agentGet(runtime, path);
  const AgentExchangeOutcome outcome = agentClassify(&result);
  if (outcome == AGENT_EXCHANGE_UNAUTHORIZED) {
    agentRevokeCredentials(runtime, now);
    return;
  }

  /** Commands are copied out because every later request reuses the
   *  client's response buffer. */
  CommandBatch batch;
  const bool   succeeded =
    outcome == AGENT_EXCHANGE_SUCCEEDED
    && ProtocolI.readCommandBatch(result.body, result.bodyLength, &batch)
         == PROTOCOL_RESULT_OK;
  if (!succeeded) {
    agentLogFailure(runtime, "polling commands", &result);
  } else {
    for (uint32_t index = 0; index < batch.count; index++) {
      agentRunCommand(runtime, &batch.commands[index]);
    }
  }
  runtime->schedule = AgentScheduleI.taskFinished(
    &runtime->schedule, AGENT_TASK_POLL_COMMANDS, succeeded, now
  );
}

static void agentRefreshFeed(AgentRuntime *runtime, const uint64_t now) {
  char path[AGENT_PATH_CAPACITY];
  snprintf(
    path,
    sizeof(path),
    "/organizations/%s/feed",
    runtime->schedule.organizationId
  );
  const HttpResult result = agentGet(runtime, path);

  uint32_t   eventCount = 0;
  const bool received =
    agentClassify(&result) == AGENT_EXCHANGE_SUCCEEDED
    && ProtocolI.countFeedEvents(result.body, result.bodyLength, &eventCount)
         == PROTOCOL_RESULT_OK;
  if (!received) {
    agentLogFailure(runtime, "refreshing the event feed", &result);
  } else if (!DeviceStoreI.saveFeed(runtime->environment->storage, result.body)) {
    agentLog(runtime, AGENT_LOG_LEVEL_ERROR, "could not store the event feed");
  } else if (eventCount != runtime->lastFeedEventCount) {
    runtime->lastFeedEventCount = eventCount;
    agentLog(runtime, AGENT_LOG_LEVEL_INFO, "event feed now has %u events", eventCount);
  }
  runtime->schedule = AgentScheduleI.taskFinished(
    &runtime->schedule, AGENT_TASK_REFRESH_FEED, received, now
  );
}

static void
agentPerform(AgentRuntime *runtime, const AgentTask task, const uint64_t now) {
  switch (task) {
  case AGENT_TASK_CONNECT:
    agentConnect(runtime, now);
    break;
  case AGENT_TASK_CHECK_STATUS:
    agentCheckStatus(runtime, now);
    break;
  case AGENT_TASK_HEARTBEAT:
    agentHeartbeat(runtime, now);
    break;
  case AGENT_TASK_POLL_COMMANDS:
    agentPollCommands(runtime, now);
    break;
  case AGENT_TASK_REFRESH_FEED:
    agentRefreshFeed(runtime, now);
    break;
  }
}

/** The lowest-valued due task, i.e. the most fundamental one. */
static AgentTask agentFirstTask(const AgentTaskSet dueTasks) {
  return (AgentTask)(dueTasks & (0U - dueTasks));
}

static void agentRun(const AgentEnvironment *environment) {
  AgentRuntime runtime = {
    .environment         = environment,
    .hasCredentials      = false,
    .credentials         = {.deviceId = "", .token = ""},
    .authorizationHeader = "",
    .authorization       = {.count = 0},
    .logs                = {.first = 0, .count = 0},
    .lastFeedEventCount  = 0,
  };

  DeviceCredentials stored;
  const bool        hasStored =
    DeviceStoreI.loadCredentials(environment->storage, &stored);
  if (hasStored) {
    agentSetCredentials(&runtime, &stored);
  }
  runtime.schedule =
    AgentScheduleI.create(hasStored, LifecycleI.monotonicSeconds());

  agentLog(
    &runtime,
    AGENT_LOG_LEVEL_INFO,
    "Puppet %s started (identifier %s, %s)",
    environment->puppetVersion,
    environment->config->deviceIdentifier,
    hasStored ? "resuming stored enrollment" : "not enrolled yet"
  );

  for (;;) {
    const uint64_t     now      = LifecycleI.monotonicSeconds();
    const AgentTaskSet dueTasks = AgentScheduleI.dueTasks(&runtime.schedule, now);
    if (dueTasks != 0) {
      agentPerform(&runtime, agentFirstTask(dueTasks), now);
      if (LifecycleI.waitFor(environment->lifecycle, AGENT_NO_WAIT_SECONDS)) {
        break;
      }
      continue;
    }

    const uint64_t untilNextTask =
      AgentScheduleI.secondsUntilNextTask(&runtime.schedule, now);
    const uint64_t sleepSeconds = untilNextTask < AGENT_MAX_SLEEP_SECONDS
                                  ? untilNextTask
                                  : AGENT_MAX_SLEEP_SECONDS;
    if (LifecycleI.waitFor(environment->lifecycle, sleepSeconds)) {
      break;
    }
  }
  fprintf(stderr, "[info] termination requested; shutting down\n");
}

const struct AgentType AgentI = {
  .run = agentRun,
};
