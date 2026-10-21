#include "agent.h"

#include "agent/agent-schedule.h"
#include "commands/command-executor.h"
#include "device-store/device-store.h"
#include "protocol/protocol.h"
#include "stats/stats.h"
#include "wakeup/wakeup.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/**
 * Room for the "before" or "after" text of one Audit Trail entry. The longest
 * is an update's "<version> sha256:<digest>" (about 105 characters), so
 * `snprintf` never truncates it.
 */
#define AGENT_AUDIT_TEXT_CAPACITY ((size_t)192)

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

/** Milliseconds per second, to turn the schedule's waits into `poll` timeouts. */
#define AGENT_MILLISECONDS_PER_SECOND ((uint64_t)1000)

/** Wait when a task is already due: only poll the descriptors, never sleep. */
#define AGENT_NO_SLEEP_SECONDS ((uint64_t)0)

/**
 * Longest the loop sleeps while the broker is connected: the library sends
 * its keep-alive pings from `serve`, which wants to run about once a second.
 */
#define AGENT_BROKER_MAINTENANCE_MILLISECONDS ((uint64_t)1000)

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

  /**
   * Whether the heartbeat must report `degraded` while the line is queued.
   * Errors do, except the loss of the Wake-up broker: Commands still arrive
   * with the heartbeat then, so the Device is not unhealthy.
   */
  bool affectsHealth;

  char message[AGENT_LOG_MESSAGE_CAPACITY];
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

  /** Set once an update is installed; the loop then stops. */
  bool restartRequested;

  /** Connection to the Wake-up broker; open exactly while the schedule says so. */
  WakeupListener wakeup;

  /**
   * Whether the loss of the broker was already logged. Keeps the logs to one
   * line per outage and one per recovery, however many attempts it takes.
   */
  bool brokerOutageReported;

  /**
   * Whether `schedule.phase` was confirmed by Puppeteer or by this process
   * itself. False after resuming stored credentials, until the first status
   * check: the phase is then only a starting point, so a change from it is
   * not a change made to the Device.
   */
  bool phaseConfirmed;
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

static const char *agentLogLevelPrefix(const AgentLogLevel level) {
  switch (level) {
  case AGENT_LOG_LEVEL_INFO:
    return AGENT_LOG_INFO_PREFIX;
  case AGENT_LOG_LEVEL_WARNING:
    return AGENT_LOG_WARNING_PREFIX;
  case AGENT_LOG_LEVEL_ERROR:
    break;
  }
  return AGENT_LOG_ERROR_PREFIX;
}

static void agentQueueLog(
  AgentLogQueue       *queue,
  const AgentLogLevel  level,
  const bool           affectsHealth,
  const char          *message
) {
  if (queue->count == AGENT_LOG_QUEUE_CAPACITY) {
    queue->first = (queue->first + 1) % AGENT_LOG_QUEUE_CAPACITY;
    queue->count--;
  }
  AgentLogEntry *entry =
    &queue->entries[(queue->first + queue->count) % AGENT_LOG_QUEUE_CAPACITY];
  entry->level         = level;
  entry->affectsHealth = affectsHealth;
  snprintf(entry->message, sizeof(entry->message), "%s", message);
  queue->count++;
}

/** Log to standard error (journald) and queue the line for Puppeteer. */
static void agentRecordLog(
  AgentRuntime       *runtime,
  const AgentLogLevel level,
  const bool          affectsHealth,
  const char         *format,
  va_list             arguments
) {
  char message[AGENT_LOG_MESSAGE_CAPACITY];
  vsnprintf(message, sizeof(message), format, arguments);

  fprintf(stderr, "%s%s\n", agentLogLevelPrefix(level), message);
  agentQueueLog(&runtime->logs, level, affectsHealth, message);
}

/** An error line makes the heartbeat `degraded` until it is shipped. */
__attribute__((format(printf, 3, 4))) static void agentLog(
  AgentRuntime *runtime, const AgentLogLevel level, const char *format, ...
) {
  va_list arguments;
  va_start(arguments, format);
  agentRecordLog(runtime, level, level == AGENT_LOG_LEVEL_ERROR, format, arguments);
  va_end(arguments);
}

/** A line about the Wake-up broker: never makes the heartbeat `degraded`. */
__attribute__((format(printf, 3, 4))) static void agentLogBroker(
  AgentRuntime *runtime, const AgentLogLevel level, const char *format, ...
) {
  va_list arguments;
  va_start(arguments, format);
  agentRecordLog(runtime, level, false, format, arguments);
  va_end(arguments);
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

static const char *agentPhaseName(const AgentPhase phase) {
  switch (phase) {
  case AGENT_PHASE_UNENROLLED:
    return "not enrolled";
  case AGENT_PHASE_PENDING:
    return "pending";
  case AGENT_PHASE_ACTIVE:
    return "active";
  case AGENT_PHASE_REJECTED:
    break;
  }
  return "rejected";
}

/**
 * Append a change to the Device Audit Trail. A failure is reported like any
 * other error and never stops the change itself: the trail is a record, not
 * a gate.
 */
static void agentAudit(
  AgentRuntime         *runtime,
  const AuditTrailActor actor,
  const char           *what,
  const char           *before,
  const char           *after
) {
  const AuditTrailResultCode code = AuditTrailI.record(
    runtime->environment->auditTrailPath, actor, what, before, after
  );
  if (code != AUDIT_TRAIL_RESULT_OK) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "could not record \"%s\" in the audit trail (%d)",
      what,
      code
    );
  }
}

/**
 * Format the text of an Audit Trail entry into `buffer`, of
 * `AGENT_AUDIT_TEXT_CAPACITY` bytes. A text that does not fit is logged as an
 * error and the entry is not written: a cut text would misstate the change.
 */
__attribute__((format(printf, 4, 5))) static bool agentFormatAuditText(
  AgentRuntime *runtime, char *buffer, const char *what, const char *format, ...
) {
  va_list arguments;
  va_start(arguments, format);
  const int32_t written =
    vsnprintf(buffer, AGENT_AUDIT_TEXT_CAPACITY, format, arguments);
  va_end(arguments);
  if (written < 0 || (size_t)written >= AGENT_AUDIT_TEXT_CAPACITY) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "could not record \"%s\" in the audit trail: its text does not fit",
      what
    );
    return false;
  }
  return true;
}

static AuditTrailActor agentActor(void) {
  return (AuditTrailActor){.kind = AUDIT_TRAIL_ACTOR_AGENT, .identifier = NULL};
}

static AuditTrailActor agentCommandActor(const Command *command) {
  return (AuditTrailActor){
    .kind = AUDIT_TRAIL_ACTOR_COMMAND, .identifier = command->id
  };
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
  char before[AGENT_AUDIT_TEXT_CAPACITY];
  if (agentFormatAuditText(
        runtime,
        before,
        AUDIT_TRAIL_WHAT_ENROLLMENT,
        "%s as device %s",
        agentPhaseName(runtime->schedule.phase),
        runtime->credentials.deviceId
      )) {
    agentAudit(
      runtime,
      agentActor(),
      AUDIT_TRAIL_WHAT_ENROLLMENT,
      before,
      AUDIT_TRAIL_STATE_CREDENTIALS_REVOKED
    );
  }
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
    NULL,
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
  char after[AGENT_AUDIT_TEXT_CAPACITY];
  if (agentFormatAuditText(
        runtime,
        after,
        AUDIT_TRAIL_WHAT_ENROLLMENT,
        "%s as device %s",
        agentPhaseName(AGENT_PHASE_PENDING),
        credentials.deviceId
      )) {
    agentAudit(
      runtime, agentActor(), AUDIT_TRAIL_WHAT_ENROLLMENT, AUDIT_TRAIL_STATE_NOT_ENROLLED, after
    );
  }
  agentLog(
    runtime,
    AGENT_LOG_LEVEL_INFO,
    AGENT_LOG_ENROLLMENT_PENDING " as device %s",
    credentials.deviceId
  );
}

static void agentLogPhase(AgentRuntime *runtime, const DeviceState *state) {
  switch (runtime->schedule.phase) {
  case AGENT_PHASE_PENDING:
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_INFO,
      AGENT_LOG_ENROLLMENT_PENDING " as device %s",
      runtime->credentials.deviceId
    );
    break;
  case AGENT_PHASE_ACTIVE:
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_INFO,
      AGENT_LOG_ENROLLMENT_APPROVED " as \"%s\" in organization %s",
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

/**
 * Record a phase change Puppeteer reported. Not after resuming stored
 * credentials: the first status check then only confirms a starting point.
 */
static void agentRecordPhaseChange(
  AgentRuntime *runtime, const AgentPhase previousPhase, const DeviceState *state
) {
  if (!runtime->phaseConfirmed) {
    return;
  }
  char       after[AGENT_AUDIT_TEXT_CAPACITY];
  const bool described =
    state->hasOrganization
      ? agentFormatAuditText(
          runtime,
          after,
          AUDIT_TRAIL_WHAT_ENROLLMENT,
          "%s in organization %s",
          agentPhaseName(runtime->schedule.phase),
          state->organizationId
        )
      : agentFormatAuditText(
          runtime,
          after,
          AUDIT_TRAIL_WHAT_ENROLLMENT,
          "%s",
          agentPhaseName(runtime->schedule.phase)
        );
  if (described) {
    agentAudit(
      runtime,
      agentActor(),
      AUDIT_TRAIL_WHAT_ENROLLMENT,
      agentPhaseName(previousPhase),
      after
    );
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
  const bool changed = runtime->schedule.phase != previousPhase;
  /** Also on the first check after starting: see the logging contract. */
  if (changed || !runtime->phaseConfirmed) {
    agentLogPhase(runtime, &state);
  }
  if (changed) {
    agentRecordPhaseChange(runtime, previousPhase, &state);
  }
  runtime->phaseConfirmed = true;
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
    if (entry->affectsHealth) {
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
  bool       commandsWaiting = false;
  const bool delivered       = outcome == AGENT_EXCHANGE_SUCCEEDED;
  /** An answer without a boolean flag is never read as "nothing waits": it
   *  fails the heartbeat, and the error reaches Admins through the logs. */
  const ProtocolResultCode decoded =
    delivered ? ProtocolI.readHeartbeatAnswer(
                  result.body, result.bodyLength, &commandsWaiting
                )
              : PROTOCOL_RESULT_OK;
  const bool answered = delivered && decoded == PROTOCOL_RESULT_OK;
  if (!delivered) {
    agentLogFailure(runtime, "sending heartbeat", &result);
  } else if (!answered) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "heartbeat answer rejected: protocol error %d",
      (int32_t)decoded
    );
  }
  if (delivered) {
    /** The exchange worked even if the answer was unusable, and an unusable
     *  answer is exactly what Admins must be able to read in the logs. */
    agentFlushLogs(runtime);
  }
  if (answered) {
    runtime->schedule =
      AgentScheduleI.heartbeatAnswered(&runtime->schedule, commandsWaiting, now);
  }
  runtime->schedule = AgentScheduleI.taskFinished(
    &runtime->schedule, AGENT_TASK_HEARTBEAT, answered, now
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

static bool agentUpdate(AgentRuntime *runtime, const Command *command) {
  UpdateInstruction        instruction;
  const ProtocolResultCode payloadCode =
    ProtocolI.readUpdateInstruction(command->payload, &instruction);
  if (payloadCode != PROTOCOL_RESULT_OK) {
    agentLog(
      runtime, AGENT_LOG_LEVEL_ERROR, "invalid update payload (%d)", payloadCode
    );
    return false;
  }
  const SelfUpdatePaths *paths = runtime->environment->updatePaths;
  if (paths == NULL) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "cannot update: the executable's location is unknown"
    );
    return false;
  }

  agentLog(
    runtime,
    AGENT_LOG_LEVEL_INFO,
    "downloading update %s from %s",
    instruction.hasVersion ? instruction.version : "(unversioned)",
    instruction.location
  );
  /** The Device token only ever goes to Puppeteer itself, never to the
   *  third-party hosts an absolute URL may point to. */
  const HttpExtraHeaders *headers =
    instruction.location[0] == '/' ? &runtime->authorization : NULL;
  const HttpResult result = HttpClientI.download(
    runtime->environment->httpClient,
    instruction.location,
    headers,
    paths->stagingPath
  );
  if (result.code == HTTP_RESULT_FILE_ERROR) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "cannot write the update to %s",
      paths->stagingPath
    );
    return false;
  }
  if (agentClassify(&result) != AGENT_EXCHANGE_SUCCEEDED) {
    agentLogFailure(runtime, "downloading the update", &result);
    SelfUpdateI.discardStaged(paths);
    return false;
  }

  const SelfUpdateResultCode installCode =
    SelfUpdateI.install(paths, instruction.sha256);
  if (installCode != SELF_UPDATE_RESULT_OK) {
    agentLog(
      runtime,
      AGENT_LOG_LEVEL_ERROR,
      "update rejected or not installed (%d)",
      installCode
    );
    return false;
  }
  /**
   * Recorded as a change of the binary, like the Installation's, so the
   * latest "binary" entry always describes what is installed. Without a
   * version only the digest is known, and only the digest is written.
   */
  char after[AGENT_AUDIT_TEXT_CAPACITY];
  char digest[SHA256_HEX_DIGEST_CAPACITY];
  Sha256I.formatHexDigest(instruction.sha256, digest);
  const bool described =
    instruction.hasVersion
      ? agentFormatAuditText(
          runtime,
          after,
          AUDIT_TRAIL_WHAT_BINARY,
          "%s " AUDIT_TRAIL_DIGEST_PREFIX "%s",
          instruction.version,
          digest
        )
      : agentFormatAuditText(
          runtime, after, AUDIT_TRAIL_WHAT_BINARY, AUDIT_TRAIL_DIGEST_PREFIX "%s", digest
        );
  if (described) {
    agentAudit(
      runtime,
      agentCommandActor(command),
      AUDIT_TRAIL_WHAT_BINARY,
      runtime->environment->puppetVersion,
      after
    );
  }
  agentLog(
    runtime,
    AGENT_LOG_LEVEL_INFO,
    "update installed at %s; restarting",
    paths->executablePath
  );
  runtime->restartRequested = true;
  return true;
}

static bool agentExecute(AgentRuntime *runtime, const Command *command) {
  if (command->type == COMMAND_TYPE_REQUEST_TELEMETRY) {
    return agentSendTelemetry(runtime);
  }
  if (command->type == COMMAND_TYPE_UPDATE) {
    return agentUpdate(runtime, command);
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

  /** Recorded before the action: a reboot or power-off may end this
   *  process before it could write anything afterwards. */
  if (command->type == COMMAND_TYPE_RESTART) {
    agentAudit(
      runtime,
      agentCommandActor(command),
      AUDIT_TRAIL_WHAT_REBOOT,
      AUDIT_TRAIL_STATE_RUNNING,
      AUDIT_TRAIL_STATE_REBOOT_REQUESTED
    );
  } else if (command->type == COMMAND_TYPE_SHUTDOWN) {
    agentAudit(
      runtime,
      agentCommandActor(command),
      AUDIT_TRAIL_WHAT_POWEROFF,
      AUDIT_TRAIL_STATE_RUNNING,
      AUDIT_TRAIL_STATE_POWEROFF_REQUESTED
    );
  }

  const bool succeeded = agentExecute(runtime, command);
  char       what[AGENT_AUDIT_TEXT_CAPACITY];
  if (agentFormatAuditText(
        runtime,
        what,
        AUDIT_TRAIL_WHAT_COMMAND_PREFIX,
        AUDIT_TRAIL_WHAT_COMMAND_PREFIX "%s",
        agentCommandTypeName(command->type)
      )) {
    agentAudit(
      runtime,
      agentCommandActor(command),
      what,
      AUDIT_TRAIL_STATE_ACKNOWLEDGED,
      succeeded ? AUDIT_TRAIL_STATE_SUCCEEDED : AUDIT_TRAIL_STATE_FAILED
    );
  }

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

static void agentFetchCommands(AgentRuntime *runtime, const uint64_t now) {
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
    agentLogFailure(runtime, "fetching commands", &result);
  } else {
    /** After an update the rest of the batch is left unacknowledged, so
     *  Puppeteer redelivers it to the new binary. */
    for (uint32_t index = 0; index < batch.count && !runtime->restartRequested;
         index++) {
      agentRunCommand(runtime, &batch.commands[index]);
    }
  }
  runtime->schedule = AgentScheduleI.taskFinished(
    &runtime->schedule, AGENT_TASK_FETCH_COMMANDS, succeeded, now
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

/** The Wake-up topic of this Device in the Organization the schedule names. */
static ProtocolResultCode
agentWakeupTopic(const AgentRuntime *runtime, char *topic, const size_t capacity) {
  return ProtocolI.writeWakeupTopic(
    runtime->credentials.deviceId, runtime->schedule.organizationId, topic, capacity
  );
}

/** Says once per outage that Wake-ups are not heard; Commands still arrive with the heartbeat. */
static void agentReportBrokerOutage(AgentRuntime *runtime, const char *reason) {
  if (runtime->brokerOutageReported) {
    return;
  }
  runtime->brokerOutageReported = true;
  agentLogBroker(
    runtime,
    AGENT_LOG_LEVEL_ERROR,
    "Wake-up broker unavailable (%s); Commands arrive with the heartbeat instead",
    reason
  );
}

static void agentReportBrokerRestored(AgentRuntime *runtime) {
  if (!runtime->brokerOutageReported) {
    return;
  }
  runtime->brokerOutageReported = false;
  agentLogBroker(runtime, AGENT_LOG_LEVEL_INFO, "Wake-up broker available again");
}

static void agentBrokerLost(
  AgentRuntime *runtime, const char *reason, const uint64_t now
) {
  WakeupListenerI.close(&runtime->wakeup);
  agentReportBrokerOutage(runtime, reason);
  runtime->schedule =
    AgentScheduleI.brokerLost(&runtime->schedule, now, LifecycleI.randomValue());
}

static void agentConnectBroker(AgentRuntime *runtime, const uint64_t now) {
  char                     topic[PROTOCOL_WAKEUP_TOPIC_CAPACITY];
  const ProtocolResultCode written =
    agentWakeupTopic(runtime, topic, sizeof(topic));
  const WakeupResultCode opened =
    written == PROTOCOL_RESULT_OK
      ? WakeupListenerI.open(
          &runtime->wakeup, runtime->environment->wakeupBroker, topic
        )
      : WAKEUP_ERROR_TOPIC;
  if (opened != WAKEUP_RESULT_OK) {
    const WakeupEvents failure = WakeupListenerI.takeEvents(&runtime->wakeup);
    agentReportBrokerOutage(
      runtime, failure.lost ? failure.lostDescription : "could not start connecting"
    );
    runtime->schedule = AgentScheduleI.brokerConnectFinished(
      &runtime->schedule, false, now, LifecycleI.randomValue()
    );
    return;
  }
  runtime->schedule = AgentScheduleI.brokerConnectFinished(
    &runtime->schedule, true, now, LifecycleI.randomValue()
  );
}

static void agentSyncBroker(AgentRuntime *runtime, const uint64_t now) {
  switch (AgentScheduleI.brokerAction(&runtime->schedule, now)) {
  case AGENT_BROKER_ACTION_NONE:
    break;
  case AGENT_BROKER_ACTION_DROP:
    WakeupListenerI.close(&runtime->wakeup);
    runtime->schedule = AgentScheduleI.brokerDropped(&runtime->schedule, now);
    break;
  case AGENT_BROKER_ACTION_RESUBSCRIBE: {
    char                     topic[PROTOCOL_WAKEUP_TOPIC_CAPACITY];
    const ProtocolResultCode written =
      agentWakeupTopic(runtime, topic, sizeof(topic));
    if (written == PROTOCOL_RESULT_OK
        && WakeupListenerI.retarget(&runtime->wakeup, topic) == WAKEUP_RESULT_OK) {
      runtime->schedule = AgentScheduleI.brokerRetargeted(&runtime->schedule, now);
    } else {
      agentBrokerLost(runtime, "could not move the subscription", now);
    }
    break;
  }
  case AGENT_BROKER_ACTION_TIME_OUT:
    agentBrokerLost(runtime, "no answer from the broker", now);
    break;
  }
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
  case AGENT_TASK_FETCH_COMMANDS:
    agentFetchCommands(runtime, now);
    break;
  case AGENT_TASK_REFRESH_FEED:
    agentRefreshFeed(runtime, now);
    break;
  case AGENT_TASK_CONNECT_BROKER:
    agentConnectBroker(runtime, now);
    break;
  case AGENT_TASK_SYNC_BROKER:
    agentSyncBroker(runtime, now);
    break;
  }
}

/** The lowest-valued due task, i.e. the most fundamental one. */
static AgentTask agentFirstTask(const AgentTaskSet dueTasks) {
  return (AgentTask)(dueTasks & (0U - dueTasks));
}

/**
 * Feed what the broker connection did into the schedule: a Wake-up, an
 * acknowledged subscription, or the loss of the connection.
 */
static void agentApplyBrokerEvents(AgentRuntime *runtime, const uint64_t now) {
  const WakeupEvents events = WakeupListenerI.takeEvents(&runtime->wakeup);
  if (events.subscribed) {
    agentReportBrokerRestored(runtime);
    runtime->schedule = AgentScheduleI.brokerSubscribed(&runtime->schedule, now);
  }
  if (events.heard) {
    runtime->schedule = AgentScheduleI.wakeupHeard(&runtime->schedule, now);
  }
  if (events.lost) {
    agentBrokerLost(runtime, events.lostDescription, now);
  }
}

/**
 * Serve the broker connection after a wait, then apply what happened. A failed
 * connection reports itself as a `lost` event, which `agentApplyBrokerEvents`
 * turns into one outage line; a listener that is not open reports nothing, so
 * it is treated as a loss here, since the schedule believes a connection exists.
 */
static void agentServeBroker(AgentRuntime *runtime, const uint64_t now) {
  if (runtime->schedule.brokerState == AGENT_BROKER_DISCONNECTED) {
    return;
  }
  if (WakeupListenerI.serve(&runtime->wakeup) == WAKEUP_ERROR_SERVE_NOT_OPEN) {
    agentBrokerLost(runtime, "the broker connection is not open", now);
    return;
  }
  agentApplyBrokerEvents(runtime, now);
}

/**
 * Sleep until something needs attention: the next due task, the broker socket,
 * the broker's housekeeping, or a termination signal.
 */
static LifecycleActivity agentWait(
  const AgentRuntime *runtime, const uint64_t milliseconds
) {
  const bool brokerOpen =
    runtime->schedule.brokerState != AGENT_BROKER_DISCONNECTED;
  const uint64_t bounded =
    brokerOpen && milliseconds > AGENT_BROKER_MAINTENANCE_MILLISECONDS
      ? AGENT_BROKER_MAINTENANCE_MILLISECONDS
      : milliseconds;
  return LifecycleI.waitForActivity(
    runtime->environment->lifecycle,
    brokerOpen ? WakeupListenerI.descriptor(&runtime->wakeup) : LIFECYCLE_NO_DESCRIPTOR,
    brokerOpen && WakeupListenerI.wantsWrite(&runtime->wakeup),
    bounded
  );
}

static AgentExitReason agentRun(const AgentEnvironment *environment) {
  AgentRuntime runtime = {
    .environment          = environment,
    .hasCredentials       = false,
    .credentials          = {.deviceId = "", .token = ""},
    .authorizationHeader  = "",
    .authorization        = {.count = 0},
    .logs                 = {.first = 0, .count = 0},
    .lastFeedEventCount   = 0,
    .restartRequested     = false,
    .wakeup               = WakeupListenerI.create(),
    .brokerOutageReported = false,
    .phaseConfirmed       = true,
  };

  DeviceCredentials stored;
  const bool        hasStored =
    DeviceStoreI.loadCredentials(environment->storage, &stored);
  if (hasStored) {
    agentSetCredentials(&runtime, &stored);
    runtime.phaseConfirmed = false;
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
      if (runtime.restartRequested) {
        /** Best effort: lines that do not make it are lost with the process. */
        agentFlushLogs(&runtime);
        WakeupListenerI.close(&runtime.wakeup);
        return AGENT_EXIT_RESTART_REQUESTED;
      }
    }

    const uint64_t untilNextTask =
      dueTasks != 0 ? AGENT_NO_SLEEP_SECONDS
                    : AgentScheduleI.secondsUntilNextTask(&runtime.schedule, now);
    const uint64_t sleepSeconds = untilNextTask < AGENT_MAX_SLEEP_SECONDS
                                  ? untilNextTask
                                  : AGENT_MAX_SLEEP_SECONDS;
    const LifecycleActivity activity =
      agentWait(&runtime, sleepSeconds * AGENT_MILLISECONDS_PER_SECOND);
    if (activity.terminationRequested) {
      break;
    }
    agentServeBroker(&runtime, LifecycleI.monotonicSeconds());
  }
  WakeupListenerI.close(&runtime.wakeup);
  fprintf(stderr, AGENT_LOG_INFO_PREFIX "termination requested; shutting down\n");
  return AGENT_EXIT_TERMINATION_REQUESTED;
}

const struct AgentType AgentI = {
  .run = agentRun,
};
