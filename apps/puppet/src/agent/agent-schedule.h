/**
 * @file agent-schedule.h
 * @brief Pure state machine deciding what a Puppet does, and when.
 *
 * The agent loop (see `agent.h`) is an imperative shell around this module:
 * it asks which tasks are due, performs their HTTP calls, then feeds the
 * outcomes back here to obtain the next schedule. Every function is pure and
 * takes the current monotonic time explicitly, so the whole Enrollment and
 * polling policy is unit-testable without a network or a clock.
 *
 * ## Phases
 *
 * ```
 *              connect ok                 approved
 * UNENROLLED ─────────────▶ PENDING ─────────────────▶ ACTIVE
 *     ▲                        │                          │
 *     └──── token revoked ─────┴──────────────────────────┘
 *                              │ rejected
 *                              ▼
 *                          REJECTED
 * ```
 *
 * | Phase      | Tasks                                                  |
 * |------------|--------------------------------------------------------|
 * | UNENROLLED | connect (exponential backoff with jitter on failure)  |
 * | PENDING    | status check, heartbeat                                |
 * | ACTIVE     | status check, heartbeat, command fetch, feed refresh  |
 * | REJECTED   | infrequent status check                                |
 *
 * ## Fetching Commands
 *
 * Commands are never fetched on a timer. A fetch is due once on boot, when
 * the Device becomes active, and whenever a heartbeat answer says Commands
 * are waiting (`heartbeatAnswered`). So an active Device receives every
 * Command within about one heartbeat, with nothing else involved.
 *
 * Waiting in PENDING is a normal, indefinite state (ADR-0002): the Puppet
 * keeps a slow, steady cadence and never floods Puppeteer.
 */
#ifndef PUPPET_AGENT_SCHEDULE_H_
#define PUPPET_AGENT_SCHEDULE_H_

#include "protocol/protocol.h"

#include <stdbool.h>
#include <stdint.h>

/**
 * Heartbeat period. Puppeteer reports a Device offline after 60 s without a
 * heartbeat, so this tolerates two consecutive losses.
 */
#define AGENT_HEARTBEAT_INTERVAL_SECONDS ((uint64_t)20)

/** Status checks while pending: short, so approval takes effect quickly. */
#define AGENT_PENDING_STATUS_INTERVAL_SECONDS ((uint64_t)15)

/** Status checks while active: catches organization moves and revocation. */
#define AGENT_ACTIVE_STATUS_INTERVAL_SECONDS ((uint64_t)60)

/** Rejection is final on Puppeteer; an hourly check only detects resets. */
#define AGENT_REJECTED_STATUS_INTERVAL_SECONDS ((uint64_t)3600)

/**
 * Marks a task that has no timer: it becomes due only through an event (see
 * `heartbeatAnswered`). Never a time the clock can reach.
 */
#define AGENT_NEVER_DUE ((uint64_t)UINT64_MAX)

/** Feed refresh period: Events change on a scale of minutes to days. */
#define AGENT_FEED_REFRESH_INTERVAL_SECONDS ((uint64_t)300)

/** Retry period after a failed feed refresh. */
#define AGENT_FEED_RETRY_INTERVAL_SECONDS ((uint64_t)60)

/** First connect retry delay; doubles on every consecutive failure. */
#define AGENT_CONNECT_BACKOFF_BASE_SECONDS ((uint64_t)5)

/** Upper bound of the connect retry delay (before jitter). */
#define AGENT_CONNECT_BACKOFF_MAX_SECONDS ((uint64_t)300)

typedef enum {
  /** No credentials: must announce itself with a connect. */
  AGENT_PHASE_UNENROLLED = 1,
  /** Waiting for an Admin or Superadmin to approve the Device. */
  AGENT_PHASE_PENDING,
  /** Approved and assigned to an Organization. */
  AGENT_PHASE_ACTIVE,
  /** Enrollment rejected. */
  AGENT_PHASE_REJECTED,
} AgentPhase;

/** Bit flags naming the tasks the agent loop can perform. */
typedef enum {
  AGENT_TASK_CONNECT       = 1 << 0,
  AGENT_TASK_CHECK_STATUS  = 1 << 1,
  AGENT_TASK_HEARTBEAT     = 1 << 2,
  AGENT_TASK_FETCH_COMMANDS = 1 << 3,
  AGENT_TASK_REFRESH_FEED  = 1 << 4,
} AgentTask;

/** A set of `AgentTask` flags. */
typedef uint32_t AgentTaskSet;

typedef struct {
  AgentPhase phase;

  /** Monotonic times (seconds) at which each task is next due. */
  uint64_t nextConnectAt;
  uint64_t nextStatusCheckAt;
  uint64_t nextHeartbeatAt;
  uint64_t nextCommandFetchAt;
  uint64_t nextFeedRefreshAt;

  /** Consecutive connect failures, driving the backoff. */
  uint32_t connectFailureCount;

  /** Organization whose feed is displayed, once known. */
  bool hasOrganization;
  char organizationId[PROTOCOL_ORGANIZATION_ID_CAPACITY];
} AgentSchedule;

struct AgentScheduleType {
  /**
   * Initial schedule. With stored credentials the Puppet assumes PENDING and
   * immediately checks its status, which corrects the phase either way.
   */
  AgentSchedule (*const create)(bool hasCredentials, uint64_t now);

  /** Tasks due at `now` for the current phase. */
  AgentTaskSet (*const dueTasks)(const AgentSchedule *schedule, uint64_t now);

  /** Seconds until the earliest task of the current phase is due (0 if any is). */
  uint64_t (*const secondsUntilNextTask)(
    const AgentSchedule *schedule, uint64_t now
  );

  /** Connect succeeded: enter PENDING and check status and heartbeat now. */
  AgentSchedule (*const connected)(const AgentSchedule *schedule, uint64_t now);

  /**
   * Connect failed: back off exponentially.
   *
   * @param randomValue  Any random number; spreads retries of many Devices
   *                     so they do not reconnect in lockstep after an outage.
   */
  AgentSchedule (*const connectFailed)(
    const AgentSchedule *schedule, uint64_t now, uint32_t randomValue
  );

  /** Apply the Device state reported by Puppeteer. */
  AgentSchedule (*const deviceStateReceived)(
    const AgentSchedule *schedule, const DeviceState *state, uint64_t now
  );

  /** Puppeteer no longer recognizes the credentials: enroll again now. */
  AgentSchedule (*const credentialsRevoked)(
    const AgentSchedule *schedule, uint64_t now
  );

  /**
   * A heartbeat was answered and its `commandsWaiting` flag decoded. While
   * active, a true flag makes a Command fetch due now; a false flag changes
   * nothing. Call it only with a flag that was actually read: a heartbeat
   * whose answer cannot be decoded is `taskFinished` with `succeeded` false.
   */
  AgentSchedule (*const heartbeatAnswered)(
    const AgentSchedule *schedule, bool commandsWaiting, uint64_t now
  );

  /**
   * A status check, heartbeat, command fetch or feed refresh finished.
   *
   * @param task       Exactly one of those tasks.
   * @param succeeded  Whether it succeeded; only the feed retries sooner. A
   *                   failed fetch is not retried on a timer: Puppeteer keeps
   *                   reporting the Commands as waiting in the next heartbeat.
   */
  AgentSchedule (*const taskFinished)(
    const AgentSchedule *schedule, AgentTask task, bool succeeded, uint64_t now
  );
};

extern const struct AgentScheduleType AgentScheduleI;

#ifdef PUPPET_AGENT_SCHEDULE_IMPLEMENTATION
#include "agent-schedule.c"
#endif

#endif // PUPPET_AGENT_SCHEDULE_H_
