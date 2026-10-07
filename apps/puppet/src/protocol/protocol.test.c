#include "protocol/protocol.h"
#include "testing/testing.h"

#include <string.h>

/** Room for any request body built in these tests. */
#define PROTOCOL_TEST_BODY_CAPACITY ((size_t)1024)

static void protocolWritesConnectRequest(TestContext *context) {
  char              buffer[PROTOCOL_TEST_BODY_CAPACITY];
  const RequestBody body = {.buffer = buffer, .capacity = sizeof(buffer)};

  EXPECT(
    context,
    ProtocolI.writeConnectRequest("machine-1", "org-9", body)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(buffer, "{\"identifier\":\"machine-1\",\"organizationId\":\"org-9\"}")
      == 0
  );

  EXPECT(
    context,
    ProtocolI.writeConnectRequest("machine-1", NULL, body) == PROTOCOL_RESULT_OK
  );
  EXPECT(context, strcmp(buffer, "{\"identifier\":\"machine-1\"}") == 0);
}

static void protocolReportsRequestOverflow(TestContext *context) {
  char              buffer[8];
  const RequestBody body = {.buffer = buffer, .capacity = sizeof(buffer)};

  EXPECT(
    context,
    ProtocolI.writeConnectRequest("machine-1", NULL, body)
      == PROTOCOL_ERROR_CONNECT_REQUEST_OVERFLOW
  );
}

static void protocolReadsConnectResponse(TestContext *context) {
  const char *response =
    "{\"device\":{\"id\":\"dev-1\",\"status\":\"pending\","
    "\"connectedAt\":\"2026-10-07T00:00:00Z\",\"tokenHash\":\"h\"},"
    "\"token\":\"secret\"}";
  DeviceCredentials credentials;

  EXPECT(
    context,
    ProtocolI.readConnectResponse(response, strlen(response), &credentials)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, strcmp(credentials.deviceId, "dev-1") == 0);
  EXPECT(context, strcmp(credentials.token, "secret") == 0);
}

static void protocolRejectsIncompleteConnectResponse(TestContext *context) {
  const char       *response = "{\"device\":{\"status\":\"pending\"},\"token\":\"t\"}";
  DeviceCredentials credentials;

  EXPECT(
    context,
    ProtocolI.readConnectResponse(response, strlen(response), &credentials)
      == PROTOCOL_ERROR_CONNECT_RESPONSE_INCOMPLETE
  );
  EXPECT(
    context,
    ProtocolI.readConnectResponse("<html>", 6, &credentials)
      == PROTOCOL_ERROR_CONNECT_RESPONSE_MALFORMED
  );
}

static void protocolReadsPendingDeviceState(TestContext *context) {
  const char *response = "{\"id\":\"dev-1\",\"status\":\"pending\"}";
  DeviceState state;

  EXPECT(
    context,
    ProtocolI.readDeviceState(response, strlen(response), &state)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, state.status == DEVICE_STATUS_PENDING);
  EXPECT(context, !state.hasOrganization);
  EXPECT(context, state.name[0] == '\0');
}

static void protocolReadsActiveDeviceState(TestContext *context) {
  const char *response =
    "{\"id\":\"dev-1\",\"status\":\"active\",\"organizationId\":\"org-9\","
    "\"name\":\"Hall A\",\"location\":\"Ground floor\"}";
  DeviceState state;

  EXPECT(
    context,
    ProtocolI.readDeviceState(response, strlen(response), &state)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, state.status == DEVICE_STATUS_ACTIVE);
  EXPECT(context, state.hasOrganization);
  EXPECT(context, strcmp(state.organizationId, "org-9") == 0);
  EXPECT(context, strcmp(state.name, "Hall A") == 0);
}

static void protocolRejectsUnknownDeviceStatus(TestContext *context) {
  const char *response = "{\"id\":\"dev-1\",\"status\":\"archived\"}";
  DeviceState state;

  EXPECT(
    context,
    ProtocolI.readDeviceState(response, strlen(response), &state)
      == PROTOCOL_ERROR_DEVICE_STATE_UNKNOWN_STATUS
  );
}

static void protocolWritesHeartbeat(TestContext *context) {
  char              buffer[PROTOCOL_TEST_BODY_CAPACITY];
  const RequestBody body     = {.buffer = buffer, .capacity = sizeof(buffer)};
  const char *const errors[] = {"feed fetch failed", "disk \"full\""};

  EXPECT(
    context,
    ProtocolI.writeHeartbeatRequest("ok", NULL, 0, body) == PROTOCOL_RESULT_OK
  );
  EXPECT(context, strcmp(buffer, "{\"status\":\"ok\"}") == 0);

  EXPECT(
    context,
    ProtocolI.writeHeartbeatRequest("error", errors, 2, body)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(
      buffer,
      "{\"status\":\"error\",\"errors\":[\"feed fetch failed\","
      "\"disk \\\"full\\\"\"]}"
    ) == 0
  );
}

static void protocolWritesTelemetry(TestContext *context) {
  const StatsSnapshot stats = {
    .totalSystemMemory = 1024,
    .usedSystemMemory  = 512,
    .appMemoryUsage    = 64,
    .uptime            = 3600,
    .cpuTemperature    = 48.5f,
    .cpuUsage          = 12.0f,
    .storageTotal      = 4096,
    .storageUsed       = 2048,
    .ip                = "10.0.0.5",
    .osName            = "Debian GNU/Linux",
    .osVersion         = "11 (bullseye)",
    .kernelVersion     = "5.10.0",
    .username          = "",
  };
  const TelemetryReport report = {
    .stats           = &stats,
    .puppetVersion   = "0.0.1",
    .puppetStartTime = "2026-10-07T12:00:00Z",
  };
  char              buffer[PROTOCOL_TEST_BODY_CAPACITY];
  const RequestBody body = {.buffer = buffer, .capacity = sizeof(buffer)};

  EXPECT(
    context,
    ProtocolI.writeTelemetryRequest(&report, body) == PROTOCOL_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(
      buffer,
      "{\"cpuTemp\":48.50,\"memoryUsage\":512,\"diskTotal\":4096,"
      "\"diskUsage\":2048,\"puppetMemoryUsage\":64,\"uptime\":3600,"
      "\"osVersion\":\"Debian GNU/Linux 11 (bullseye)\","
      "\"kernelVersion\":\"5.10.0\",\"networkInfo\":\"10.0.0.5\","
      "\"puppetVersion\":\"0.0.1\","
      "\"puppetStartTime\":\"2026-10-07T12:00:00Z\"}"
    ) == 0
  );
}

static void protocolReadsCommandBatch(TestContext *context) {
  const char *response =
    "[{\"id\":\"c1\",\"deviceId\":\"dev-1\",\"type\":\"restart\","
    "\"status\":\"sent\",\"issuedBy\":\"u\",\"issuedAt\":\"t\"},"
    "{\"id\":\"c2\",\"type\":\"update\",\"payload\":{\"url\":\"https://x\"}},"
    "{\"id\":\"c3\",\"type\":\"self_destruct\"}]";
  CommandBatch batch;

  EXPECT(
    context,
    ProtocolI.readCommandBatch(response, strlen(response), &batch)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, batch.count == 3);
  EXPECT(context, strcmp(batch.commands[0].id, "c1") == 0);
  EXPECT(context, batch.commands[0].type == COMMAND_TYPE_RESTART);
  EXPECT(context, batch.commands[0].payload[0] == '\0');
  EXPECT(context, batch.commands[1].type == COMMAND_TYPE_UPDATE);
  EXPECT(context, strcmp(batch.commands[1].payload, "{\"url\":\"https://x\"}") == 0);
  EXPECT(context, batch.commands[2].type == COMMAND_TYPE_UNKNOWN);
}

static void protocolReadsEmptyCommandBatch(TestContext *context) {
  CommandBatch batch;

  EXPECT(context, ProtocolI.readCommandBatch("[]", 2, &batch) == PROTOCOL_RESULT_OK);
  EXPECT(context, batch.count == 0);
  EXPECT(
    context,
    ProtocolI.readCommandBatch("{}", 2, &batch)
      == PROTOCOL_ERROR_COMMAND_BATCH_MALFORMED
  );
}

static void protocolCapsCommandBatch(TestContext *context) {
  const char *response =
    "[{\"id\":\"1\",\"type\":\"custom\"},{\"id\":\"2\",\"type\":\"custom\"},"
    "{\"id\":\"3\",\"type\":\"custom\"},{\"id\":\"4\",\"type\":\"custom\"},"
    "{\"id\":\"5\",\"type\":\"custom\"},{\"id\":\"6\",\"type\":\"custom\"},"
    "{\"id\":\"7\",\"type\":\"custom\"},{\"id\":\"8\",\"type\":\"custom\"},"
    "{\"id\":\"9\",\"type\":\"custom\"}]";
  CommandBatch batch;

  EXPECT(
    context,
    ProtocolI.readCommandBatch(response, strlen(response), &batch)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, batch.count == PROTOCOL_MAX_COMMANDS_PER_BATCH);
  EXPECT(context, strcmp(batch.commands[7].id, "8") == 0);
}

static void protocolWritesCommandCompletion(TestContext *context) {
  char              buffer[PROTOCOL_TEST_BODY_CAPACITY];
  const RequestBody body = {.buffer = buffer, .capacity = sizeof(buffer)};

  EXPECT(
    context, ProtocolI.writeCommandCompletion(false, body) == PROTOCOL_RESULT_OK
  );
  EXPECT(context, strcmp(buffer, "{\"success\":false}") == 0);
}

static void protocolCountsFeedEvents(TestContext *context) {
  const char *feed =
    "[{\"id\":\"e1\",\"title\":\"Palestra\",\"voteCount\":3},"
    "{\"id\":\"e2\",\"title\":\"Workshop\",\"voteCount\":0}]";
  uint32_t eventCount = 0;

  EXPECT(
    context,
    ProtocolI.countFeedEvents(feed, strlen(feed), &eventCount)
      == PROTOCOL_RESULT_OK
  );
  EXPECT(context, eventCount == 2);

  /** A feed cut short by a truncated response must never be accepted. */
  EXPECT(
    context,
    ProtocolI.countFeedEvents(feed, strlen(feed) - 5, &eventCount)
      == PROTOCOL_ERROR_FEED_MALFORMED
  );
}

static const TestCase PROTOCOL_TEST_CASES[] = {
  {"writes connect requests with and without organization",
   protocolWritesConnectRequest},
  {"reports request overflow", protocolReportsRequestOverflow},
  {"reads the connect response", protocolReadsConnectResponse},
  {"rejects incomplete or malformed connect responses",
   protocolRejectsIncompleteConnectResponse},
  {"reads a pending device state", protocolReadsPendingDeviceState},
  {"reads an active device state", protocolReadsActiveDeviceState},
  {"rejects unknown device statuses", protocolRejectsUnknownDeviceStatus},
  {"writes heartbeats with and without errors", protocolWritesHeartbeat},
  {"writes telemetry omitting unknown strings", protocolWritesTelemetry},
  {"reads a command batch", protocolReadsCommandBatch},
  {"reads an empty command batch", protocolReadsEmptyCommandBatch},
  {"caps the command batch size", protocolCapsCommandBatch},
  {"writes command completion", protocolWritesCommandCompletion},
  {"counts feed events and rejects truncated feeds", protocolCountsFeedEvents},
};

static const TestSuite ProtocolTestSuite = {
  .name      = "protocol",
  .cases     = PROTOCOL_TEST_CASES,
  .caseCount = sizeof(PROTOCOL_TEST_CASES) / sizeof(PROTOCOL_TEST_CASES[0]),
};
