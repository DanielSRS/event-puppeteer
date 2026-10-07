#include "protocol.h"

#include "json/json.h"

#include <stdio.h>
#include <string.h>

/** Token budget for small single-object responses (connect, device state). */
#define PROTOCOL_OBJECT_TOKEN_CAPACITY ((uint32_t)128)

/** Token budget for a full command list. */
#define PROTOCOL_COMMAND_BATCH_TOKEN_CAPACITY ((uint32_t)1024)

/**
 * Token budget for an event feed. Feeds are bounded by the HTTP response
 * buffer (64 KiB), and an Event never needs fewer than ~8 bytes per token.
 */
#define PROTOCOL_FEED_TOKEN_CAPACITY ((uint32_t)8192)

/** Room for "<os name> <os version>". */
#define PROTOCOL_OS_DESCRIPTION_CAPACITY ((size_t)256)

/** Index of the root token of every parsed document. */
#define PROTOCOL_ROOT_TOKEN ((int32_t)0)

typedef struct {
  const char  *name;
  DeviceStatus status;
} DeviceStatusName;

static const DeviceStatusName DEVICE_STATUS_NAMES[] = {
  {"pending", DEVICE_STATUS_PENDING},
  {"active", DEVICE_STATUS_ACTIVE},
  {"offline", DEVICE_STATUS_OFFLINE},
  {"rejected", DEVICE_STATUS_REJECTED},
};

typedef struct {
  const char *name;
  CommandType type;
} CommandTypeName;

static const CommandTypeName COMMAND_TYPE_NAMES[] = {
  {"restart", COMMAND_TYPE_RESTART},
  {"shutdown", COMMAND_TYPE_SHUTDOWN},
  {"update", COMMAND_TYPE_UPDATE},
  {"open_ssh", COMMAND_TYPE_OPEN_SSH},
  {"custom", COMMAND_TYPE_CUSTOM},
  {"request_telemetry", COMMAND_TYPE_REQUEST_TELEMETRY},
};

static ProtocolResultCode protocolFinishRequest(
  const JsonWriter *writer, const ProtocolResultCode overflowCode
) {
  return JsonWriterI.finish(writer) == JSON_RESULT_OK ? PROTOCOL_RESULT_OK
                                                      : overflowCode;
}

static ProtocolResultCode protocolWriteConnectRequest(
  const char *identifier, const char *organizationId, const RequestBody body
) {
  JsonWriter writer = JsonWriterI.create(body.buffer, body.capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "identifier");
  JsonWriterI.string(&writer, identifier);
  if (organizationId != NULL) {
    JsonWriterI.key(&writer, "organizationId");
    JsonWriterI.string(&writer, organizationId);
  }
  JsonWriterI.endObject(&writer);
  return protocolFinishRequest(&writer, PROTOCOL_ERROR_CONNECT_REQUEST_OVERFLOW);
}

/** Copy an optional string member, leaving `destination` empty if absent. */
static bool protocolCopyOptionalMember(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    objectIndex,
  const char      *key,
  char            *destination,
  const size_t     destinationCapacity
) {
  const int32_t valueIndex =
    JsonI.findMember(text, tokens, tokenCount, objectIndex, key);
  const bool copied =
    JsonI.copyString(
      text, tokens, tokenCount, valueIndex, destination, destinationCapacity
    )
    == JSON_RESULT_OK;
  if (!copied) {
    destination[0] = '\0';
  }
  return copied;
}

static ProtocolResultCode protocolReadConnectResponse(
  const char        *body,
  const size_t       bodyLength,
  DeviceCredentials *credentials
) {
  JsonToken             tokens[PROTOCOL_OBJECT_TOKEN_CAPACITY];
  const JsonParseResult parsed =
    JsonI.parse(body, bodyLength, tokens, PROTOCOL_OBJECT_TOKEN_CAPACITY);
  if (parsed.code != JSON_RESULT_OK) {
    return PROTOCOL_ERROR_CONNECT_RESPONSE_MALFORMED;
  }

  const int32_t deviceIndex = JsonI.findMember(
    body, tokens, parsed.tokenCount, PROTOCOL_ROOT_TOKEN, "device"
  );
  const bool hasDeviceId = protocolCopyOptionalMember(
    body,
    tokens,
    parsed.tokenCount,
    deviceIndex,
    "id",
    credentials->deviceId,
    sizeof(credentials->deviceId)
  );
  const bool hasToken = protocolCopyOptionalMember(
    body,
    tokens,
    parsed.tokenCount,
    PROTOCOL_ROOT_TOKEN,
    "token",
    credentials->token,
    sizeof(credentials->token)
  );
  if (!hasDeviceId || !hasToken) {
    return PROTOCOL_ERROR_CONNECT_RESPONSE_INCOMPLETE;
  }
  return PROTOCOL_RESULT_OK;
}

static ProtocolResultCode protocolReadDeviceState(
  const char *body, const size_t bodyLength, DeviceState *state
) {
  JsonToken             tokens[PROTOCOL_OBJECT_TOKEN_CAPACITY];
  const JsonParseResult parsed =
    JsonI.parse(body, bodyLength, tokens, PROTOCOL_OBJECT_TOKEN_CAPACITY);
  if (parsed.code != JSON_RESULT_OK
      || tokens[PROTOCOL_ROOT_TOKEN].kind != JSON_TOKEN_OBJECT) {
    return PROTOCOL_ERROR_DEVICE_STATE_MALFORMED;
  }

  const int32_t statusIndex = JsonI.findMember(
    body, tokens, parsed.tokenCount, PROTOCOL_ROOT_TOKEN, "status"
  );
  const int32_t idIndex = JsonI.findMember(
    body, tokens, parsed.tokenCount, PROTOCOL_ROOT_TOKEN, "id"
  );
  if (statusIndex == JSON_NOT_FOUND || idIndex == JSON_NOT_FOUND) {
    return PROTOCOL_ERROR_DEVICE_STATE_INCOMPLETE;
  }

  const uint32_t statusCount =
    sizeof(DEVICE_STATUS_NAMES) / sizeof(DEVICE_STATUS_NAMES[0]);
  uint32_t statusPosition = 0;
  while (statusPosition < statusCount
         && !JsonI.equals(
           body,
           tokens,
           parsed.tokenCount,
           statusIndex,
           DEVICE_STATUS_NAMES[statusPosition].name
         )) {
    statusPosition++;
  }
  if (statusPosition == statusCount) {
    return PROTOCOL_ERROR_DEVICE_STATE_UNKNOWN_STATUS;
  }

  state->status          = DEVICE_STATUS_NAMES[statusPosition].status;
  state->hasOrganization = protocolCopyOptionalMember(
    body,
    tokens,
    parsed.tokenCount,
    PROTOCOL_ROOT_TOKEN,
    "organizationId",
    state->organizationId,
    sizeof(state->organizationId)
  );
  protocolCopyOptionalMember(
    body,
    tokens,
    parsed.tokenCount,
    PROTOCOL_ROOT_TOKEN,
    "name",
    state->name,
    sizeof(state->name)
  );
  return PROTOCOL_RESULT_OK;
}

static ProtocolResultCode protocolWriteHeartbeatRequest(
  const char        *status,
  const char *const *errors,
  const uint32_t     errorCount,
  const RequestBody  body
) {
  JsonWriter writer = JsonWriterI.create(body.buffer, body.capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "status");
  JsonWriterI.string(&writer, status);
  if (errorCount > 0) {
    JsonWriterI.key(&writer, "errors");
    JsonWriterI.beginArray(&writer);
    for (uint32_t index = 0; index < errorCount; index++) {
      JsonWriterI.string(&writer, errors[index]);
    }
    JsonWriterI.endArray(&writer);
  }
  JsonWriterI.endObject(&writer);
  return protocolFinishRequest(&writer, PROTOCOL_ERROR_HEARTBEAT_REQUEST_OVERFLOW);
}

static ProtocolResultCode protocolWriteLogRequest(
  const char *level, const char *message, const RequestBody body
) {
  JsonWriter writer = JsonWriterI.create(body.buffer, body.capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "level");
  JsonWriterI.string(&writer, level);
  JsonWriterI.key(&writer, "message");
  JsonWriterI.string(&writer, message);
  JsonWriterI.endObject(&writer);
  return protocolFinishRequest(&writer, PROTOCOL_ERROR_LOG_REQUEST_OVERFLOW);
}

static void protocolWriteStringMember(
  JsonWriter *writer, const char *key, const char *value
) {
  /** Puppeteer treats absent and empty differently; unknown values are
   *  omitted so they never overwrite a meaningful previous report. */
  if (value[0] == '\0') {
    return;
  }
  JsonWriterI.key(writer, key);
  JsonWriterI.string(writer, value);
}

static ProtocolResultCode protocolWriteTelemetryRequest(
  const TelemetryReport *report, const RequestBody body
) {
  const StatsSnapshot *stats = report->stats;

  char osDescription[PROTOCOL_OS_DESCRIPTION_CAPACITY];
  if (stats->osVersion[0] == '\0') {
    snprintf(osDescription, sizeof(osDescription), "%s", stats->osName);
  } else {
    snprintf(
      osDescription,
      sizeof(osDescription),
      "%s %s",
      stats->osName,
      stats->osVersion
    );
  }

  JsonWriter writer = JsonWriterI.create(body.buffer, body.capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "cpuTemp");
  JsonWriterI.decimal(&writer, (double)stats->cpuTemperature);
  JsonWriterI.key(&writer, "memoryUsage");
  JsonWriterI.unsignedInteger(&writer, stats->usedSystemMemory);
  JsonWriterI.key(&writer, "diskTotal");
  JsonWriterI.unsignedInteger(&writer, stats->storageTotal);
  JsonWriterI.key(&writer, "diskUsage");
  JsonWriterI.unsignedInteger(&writer, stats->storageUsed);
  JsonWriterI.key(&writer, "puppetMemoryUsage");
  JsonWriterI.unsignedInteger(&writer, stats->appMemoryUsage);
  JsonWriterI.key(&writer, "uptime");
  JsonWriterI.unsignedInteger(&writer, stats->uptime);
  protocolWriteStringMember(&writer, "osVersion", osDescription);
  protocolWriteStringMember(&writer, "kernelVersion", stats->kernelVersion);
  protocolWriteStringMember(&writer, "networkInfo", stats->ip);
  protocolWriteStringMember(&writer, "osUsers", stats->username);
  protocolWriteStringMember(&writer, "puppetVersion", report->puppetVersion);
  protocolWriteStringMember(&writer, "puppetStartTime", report->puppetStartTime);
  JsonWriterI.endObject(&writer);
  return protocolFinishRequest(&writer, PROTOCOL_ERROR_TELEMETRY_REQUEST_OVERFLOW);
}

static CommandType protocolCommandType(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    typeIndex
) {
  const uint32_t typeCount =
    sizeof(COMMAND_TYPE_NAMES) / sizeof(COMMAND_TYPE_NAMES[0]);
  for (uint32_t position = 0; position < typeCount; position++) {
    if (JsonI.equals(
          text, tokens, tokenCount, typeIndex, COMMAND_TYPE_NAMES[position].name
        )) {
      return COMMAND_TYPE_NAMES[position].type;
    }
  }
  return COMMAND_TYPE_UNKNOWN;
}

static ProtocolResultCode protocolReadCommand(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    commandIndex,
  Command         *command
) {
  const int32_t typeIndex =
    JsonI.findMember(text, tokens, tokenCount, commandIndex, "type");
  const bool hasId = protocolCopyOptionalMember(
    text, tokens, tokenCount, commandIndex, "id", command->id, sizeof(command->id)
  );
  if (!hasId || typeIndex == JSON_NOT_FOUND) {
    return PROTOCOL_ERROR_COMMAND_INCOMPLETE;
  }
  command->type = protocolCommandType(text, tokens, tokenCount, typeIndex);

  const int32_t payloadIndex =
    JsonI.findMember(text, tokens, tokenCount, commandIndex, "payload");
  if (payloadIndex == JSON_NOT_FOUND) {
    command->payload[0] = '\0';
    return PROTOCOL_RESULT_OK;
  }
  const JsonToken *payload       = &tokens[payloadIndex];
  const size_t     payloadLength = payload->end - payload->start;
  if (payloadLength >= sizeof(command->payload)) {
    return PROTOCOL_ERROR_COMMAND_PAYLOAD_TOO_LARGE;
  }
  memcpy(command->payload, text + payload->start, payloadLength);
  command->payload[payloadLength] = '\0';
  return PROTOCOL_RESULT_OK;
}

static ProtocolResultCode protocolReadCommandBatch(
  const char *body, const size_t bodyLength, CommandBatch *batch
) {
  JsonToken             tokens[PROTOCOL_COMMAND_BATCH_TOKEN_CAPACITY];
  const JsonParseResult parsed = JsonI.parse(
    body, bodyLength, tokens, PROTOCOL_COMMAND_BATCH_TOKEN_CAPACITY
  );
  if (parsed.code != JSON_RESULT_OK
      || tokens[PROTOCOL_ROOT_TOKEN].kind != JSON_TOKEN_ARRAY) {
    return PROTOCOL_ERROR_COMMAND_BATCH_MALFORMED;
  }

  const uint32_t available = tokens[PROTOCOL_ROOT_TOKEN].childCount;
  const uint32_t readCount = available < PROTOCOL_MAX_COMMANDS_PER_BATCH
                             ? available
                             : PROTOCOL_MAX_COMMANDS_PER_BATCH;
  batch->count = 0;
  for (uint32_t position = 0; position < readCount; position++) {
    const int32_t commandIndex = JsonI.arrayElement(
      tokens, parsed.tokenCount, PROTOCOL_ROOT_TOKEN, position
    );
    const ProtocolResultCode code = protocolReadCommand(
      body, tokens, parsed.tokenCount, commandIndex, &batch->commands[position]
    );
    if (code != PROTOCOL_RESULT_OK) {
      return code;
    }
    batch->count++;
  }
  return PROTOCOL_RESULT_OK;
}

static ProtocolResultCode protocolWriteCommandCompletion(
  const bool succeeded, const RequestBody body
) {
  JsonWriter writer = JsonWriterI.create(body.buffer, body.capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "success");
  JsonWriterI.boolean(&writer, succeeded);
  JsonWriterI.endObject(&writer);
  return protocolFinishRequest(
    &writer, PROTOCOL_ERROR_COMPLETION_REQUEST_OVERFLOW
  );
}

static ProtocolResultCode protocolCountFeedEvents(
  const char *body, const size_t bodyLength, uint32_t *eventCount
) {
  JsonToken             tokens[PROTOCOL_FEED_TOKEN_CAPACITY];
  const JsonParseResult parsed =
    JsonI.parse(body, bodyLength, tokens, PROTOCOL_FEED_TOKEN_CAPACITY);
  if (parsed.code != JSON_RESULT_OK
      || tokens[PROTOCOL_ROOT_TOKEN].kind != JSON_TOKEN_ARRAY) {
    return PROTOCOL_ERROR_FEED_MALFORMED;
  }
  *eventCount = tokens[PROTOCOL_ROOT_TOKEN].childCount;
  return PROTOCOL_RESULT_OK;
}

static bool protocolIsValidUpdateLocation(const char *location) {
  return location[0] == '/' || strncmp(location, "https://", 8) == 0
      || strncmp(location, "http://", 7) == 0;
}

static ProtocolResultCode protocolReadUpdateInstruction(
  const char *payload, UpdateInstruction *instruction
) {
  JsonToken             tokens[PROTOCOL_OBJECT_TOKEN_CAPACITY];
  const JsonParseResult parsed = JsonI.parse(
    payload, strlen(payload), tokens, PROTOCOL_OBJECT_TOKEN_CAPACITY
  );
  if (parsed.code != JSON_RESULT_OK
      || tokens[PROTOCOL_ROOT_TOKEN].kind != JSON_TOKEN_OBJECT) {
    return PROTOCOL_ERROR_UPDATE_PAYLOAD_MALFORMED;
  }

  if (!protocolCopyOptionalMember(
        payload,
        tokens,
        parsed.tokenCount,
        PROTOCOL_ROOT_TOKEN,
        "url",
        instruction->location,
        sizeof(instruction->location)
      )) {
    return PROTOCOL_ERROR_UPDATE_LOCATION_MISSING;
  }
  if (!protocolIsValidUpdateLocation(instruction->location)) {
    return PROTOCOL_ERROR_UPDATE_LOCATION_INVALID;
  }

  char       digestText[SHA256_HEX_DIGEST_CAPACITY];
  const bool hasDigest = protocolCopyOptionalMember(
    payload,
    tokens,
    parsed.tokenCount,
    PROTOCOL_ROOT_TOKEN,
    "sha256",
    digestText,
    sizeof(digestText)
  );
  if (!hasDigest || !Sha256I.parseHexDigest(digestText, instruction->sha256)) {
    return PROTOCOL_ERROR_UPDATE_DIGEST_INVALID;
  }

  instruction->hasVersion = protocolCopyOptionalMember(
    payload,
    tokens,
    parsed.tokenCount,
    PROTOCOL_ROOT_TOKEN,
    "version",
    instruction->version,
    sizeof(instruction->version)
  );
  return PROTOCOL_RESULT_OK;
}

const struct ProtocolType ProtocolI = {
  .writeConnectRequest    = protocolWriteConnectRequest,
  .readConnectResponse    = protocolReadConnectResponse,
  .readDeviceState        = protocolReadDeviceState,
  .writeHeartbeatRequest  = protocolWriteHeartbeatRequest,
  .writeLogRequest        = protocolWriteLogRequest,
  .writeTelemetryRequest  = protocolWriteTelemetryRequest,
  .readCommandBatch       = protocolReadCommandBatch,
  .writeCommandCompletion = protocolWriteCommandCompletion,
  .countFeedEvents        = protocolCountFeedEvents,
  .readUpdateInstruction  = protocolReadUpdateInstruction,
};
