/**
 * @file protocol.h
 * @brief Pure encoding and decoding of the Puppet ⇄ Puppeteer device protocol.
 *
 * Every function here is pure: it reads a request's inputs or a response body
 * and writes into caller-provided memory. No IO happens in this module; the
 * agent performs the HTTP calls and hands bodies to these functions.
 *
 * ## Endpoints covered
 *
 * | Direction | Endpoint                                    | Function                  |
 * |-----------|---------------------------------------------|---------------------------|
 * | request   | POST /devices/connect                       | `writeConnectRequest`     |
 * | response  | POST /devices/connect                       | `readConnectResponse`     |
 * | response  | GET  /devices/me                            | `readDeviceState`         |
 * | request   | POST /devices/:id/heartbeat                 | `writeHeartbeatRequest`   |
 * | request   | POST /devices/:id/logs                      | `writeLogRequest`         |
 * | request   | POST /devices/:id/telemetry                 | `writeTelemetryRequest`   |
 * | response  | GET  /devices/:id/commands/pending          | `readCommandBatch`        |
 * | request   | POST /devices/:id/commands/:cid/complete    | `writeCommandCompletion`  |
 * | response  | GET  /organizations/:id/feed                | `countFeedEvents`         |
 *
 * ## Errors
 *
 * All functions return a `ProtocolResultCode`. Codes are unique per failure
 * path in the 2000–2999 range.
 */
#ifndef PUPPET_PROTOCOL_H_
#define PUPPET_PROTOCOL_H_

#include "stats/stats.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** Device ids are UUIDs (36 characters) plus terminator, with headroom. */
#define PROTOCOL_DEVICE_ID_CAPACITY ((size_t)64)

/** Device tokens are 64 hexadecimal characters plus terminator. */
#define PROTOCOL_DEVICE_TOKEN_CAPACITY ((size_t)128)

#define PROTOCOL_ORGANIZATION_ID_CAPACITY ((size_t)64)
#define PROTOCOL_DEVICE_NAME_CAPACITY     ((size_t)128)
#define PROTOCOL_COMMAND_ID_CAPACITY      ((size_t)64)

/** Raw JSON of a command's payload, e.g. an update's download location. */
#define PROTOCOL_COMMAND_PAYLOAD_CAPACITY ((size_t)1024)

/**
 * Commands read per poll. Any excess stays pending on Puppeteer and is
 * delivered by the next poll.
 */
#define PROTOCOL_MAX_COMMANDS_PER_BATCH ((uint32_t)8)

typedef enum {
  PROTOCOL_RESULT_OK = 0,

  /** The connect response is not valid JSON. */
  PROTOCOL_ERROR_CONNECT_RESPONSE_MALFORMED = 2001,
  /** The connect response lacks `device.id` or `token`. */
  PROTOCOL_ERROR_CONNECT_RESPONSE_INCOMPLETE = 2002,
  /** The device state response is not valid JSON. */
  PROTOCOL_ERROR_DEVICE_STATE_MALFORMED = 2003,
  /** The device state response lacks `id` or `status`. */
  PROTOCOL_ERROR_DEVICE_STATE_INCOMPLETE = 2004,
  /** The device state has a status this Puppet does not know. */
  PROTOCOL_ERROR_DEVICE_STATE_UNKNOWN_STATUS = 2005,
  /** The command list is not a valid JSON array. */
  PROTOCOL_ERROR_COMMAND_BATCH_MALFORMED = 2006,
  /** A command lacks `id` or `type`. */
  PROTOCOL_ERROR_COMMAND_INCOMPLETE = 2007,
  /** A command's payload exceeds `PROTOCOL_COMMAND_PAYLOAD_CAPACITY`. */
  PROTOCOL_ERROR_COMMAND_PAYLOAD_TOO_LARGE = 2008,
  /** The event feed is not a valid JSON array. */
  PROTOCOL_ERROR_FEED_MALFORMED = 2009,

  /** A request body did not fit its buffer. */
  PROTOCOL_ERROR_CONNECT_REQUEST_OVERFLOW = 2010,
  PROTOCOL_ERROR_HEARTBEAT_REQUEST_OVERFLOW = 2011,
  PROTOCOL_ERROR_LOG_REQUEST_OVERFLOW = 2012,
  PROTOCOL_ERROR_TELEMETRY_REQUEST_OVERFLOW = 2013,
  PROTOCOL_ERROR_COMPLETION_REQUEST_OVERFLOW = 2014,
} ProtocolResultCode;

/** What a Puppet needs to authenticate as its Device. Persisted locally. */
typedef struct {
  char deviceId[PROTOCOL_DEVICE_ID_CAPACITY];
  char token[PROTOCOL_DEVICE_TOKEN_CAPACITY];
} DeviceCredentials;

/** Enrollment status of the Device, as decided by Puppeteer. */
typedef enum {
  /** Waiting for an Admin or Superadmin to approve it. */
  DEVICE_STATUS_PENDING = 1,
  /** Approved: receives the feed and Commands. */
  DEVICE_STATUS_ACTIVE,
  /** Approved, but currently considered offline by Puppeteer. */
  DEVICE_STATUS_OFFLINE,
  /** Enrollment was rejected; the Device will never be activated. */
  DEVICE_STATUS_REJECTED,
} DeviceStatus;

typedef struct {
  DeviceStatus status;

  /** Whether `organizationId` holds a value. */
  bool hasOrganization;
  char organizationId[PROTOCOL_ORGANIZATION_ID_CAPACITY];

  /** Name given at approval, or an empty string while pending. */
  char name[PROTOCOL_DEVICE_NAME_CAPACITY];
} DeviceState;

typedef enum {
  COMMAND_TYPE_RESTART = 1,
  COMMAND_TYPE_SHUTDOWN,
  COMMAND_TYPE_UPDATE,
  COMMAND_TYPE_OPEN_SSH,
  COMMAND_TYPE_CUSTOM,
  COMMAND_TYPE_REQUEST_TELEMETRY,

  /** A type introduced by a newer Puppeteer. It must be reported as failed. */
  COMMAND_TYPE_UNKNOWN,
} CommandType;

/** An instruction sent from Puppeteer to this Device. */
typedef struct {
  char        id[PROTOCOL_COMMAND_ID_CAPACITY];
  CommandType type;

  /** Raw JSON object of the payload, or an empty string when absent. */
  char payload[PROTOCOL_COMMAND_PAYLOAD_CAPACITY];
} Command;

typedef struct {
  Command  commands[PROTOCOL_MAX_COMMANDS_PER_BATCH];
  uint32_t count;
} CommandBatch;

/** Everything sent in a detailed Telemetry report. */
typedef struct {
  const StatsSnapshot *stats;

  /** Version of this Puppet build, e.g. "0.0.1". */
  const char *puppetVersion;

  /** ISO-8601 UTC time at which this Puppet process started. */
  const char *puppetStartTime;
} TelemetryReport;

/** A writable request body buffer. */
typedef struct {
  char  *buffer;
  size_t capacity;
} RequestBody;

struct ProtocolType {
  /**
   * Enrollment request announcing this Puppet to Puppeteer.
   *
   * @param identifier      Stable hardware identity (e.g. the machine id).
   * @param organizationId  Organization to request enrollment into, or NULL
   *                        to land in the Superadmin's pending queue.
   */
  ProtocolResultCode (*const writeConnectRequest)(
    const char *identifier, const char *organizationId, RequestBody body
  );

  /** Extract the credentials issued by Puppeteer on connect. */
  ProtocolResultCode (*const readConnectResponse)(
    const char *body, size_t bodyLength, DeviceCredentials *credentials
  );

  /** Read this Device's enrollment status and organization. */
  ProtocolResultCode (*const readDeviceState)(
    const char *body, size_t bodyLength, DeviceState *state
  );

  /**
   * Liveness signal.
   *
   * @param status      Short health summary, e.g. "ok".
   * @param errors      Error messages since the previous heartbeat.
   * @param errorCount  Number of entries in `errors` (may be 0).
   */
  ProtocolResultCode (*const writeHeartbeatRequest)(
    const char        *status,
    const char *const *errors,
    uint32_t           errorCount,
    RequestBody        body
  );

  /** A single log line shipped to Puppeteer. */
  ProtocolResultCode (*const writeLogRequest)(
    const char *level, const char *message, RequestBody body
  );

  /** Detailed Telemetry, sent in answer to a `request_telemetry` Command. */
  ProtocolResultCode (*const writeTelemetryRequest)(
    const TelemetryReport *report, RequestBody body
  );

  /**
   * Read pending Commands. At most `PROTOCOL_MAX_COMMANDS_PER_BATCH` are
   * read; `batch->count` holds how many.
   */
  ProtocolResultCode (*const readCommandBatch)(
    const char *body, size_t bodyLength, CommandBatch *batch
  );

  /** Outcome of executing a Command. */
  ProtocolResultCode (*const writeCommandCompletion)(
    bool succeeded, RequestBody body
  );

  /**
   * Validate an event feed and count its Events. The feed itself is stored
   * verbatim; this only guards against persisting a corrupt or truncated one.
   */
  ProtocolResultCode (*const countFeedEvents)(
    const char *body, size_t bodyLength, uint32_t *eventCount
  );
};

extern const struct ProtocolType ProtocolI;

#ifdef PUPPET_PROTOCOL_IMPLEMENTATION
#include "protocol.c"
#endif

#endif // PUPPET_PROTOCOL_H_
