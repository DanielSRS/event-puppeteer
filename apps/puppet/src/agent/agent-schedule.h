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
 * | ACTIVE     | status check, heartbeat, command fetch, feed refresh, |
 * |            | Wake-up broker connection                             |
 * | REJECTED   | infrequent status check                                |
 *
 * ## Fetching Commands
 *
 * Commands are never fetched on a timer. A fetch is due once on boot, when
 * the Device becomes active, and whenever a heartbeat answer says Commands
 * are waiting (`heartbeatAnswered`). So an active Device receives every
 * Command within about one heartbeat, with nothing else involved.
 *
 * ## Wake-up broker
 *
 * Once active in an Organization the Puppet connects to the Wake-up broker and
 * subscribes to its topic. A Wake-up makes a Command fetch due at once
 * (`wakeupHeard`), and so does every acknowledged subscription
 * (`brokerSubscribed`), which covers Wake-ups sent while disconnected. The
 * broker is only an accelerator: with it down, the heartbeat flag still
 * delivers every Command, and the schedule only retries the connection, with
 * backoff, never marking the Device unhealthy.
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

/** First broker reconnect delay; doubles on every consecutive failure. */
#define AGENT_BROKER_BACKOFF_BASE_SECONDS ((uint64_t)10)

/** Upper bound of the broker reconnect delay (before jitter). */
#define AGENT_BROKER_BACKOFF_MAX_SECONDS ((uint64_t)300)

/**
 * How long a broker connection may take to reach its subscription
 * acknowledgement. A connection that stays silent is dropped and retried.
 */
#define AGENT_BROKER_HANDSHAKE_TIMEOUT_SECONDS ((uint64_t)20)

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
  /** Open the connection to the Wake-up broker. */
  AGENT_TASK_CONNECT_BROKER = 1 << 5,
  /** Bring the broker connection in line with the schedule (see `AgentBrokerAction`). */
  AGENT_TASK_SYNC_BROKER = 1 << 6,
} AgentTask;

/** How far the connection to the Wake-up broker has come. */
typedef enum {
  /** No connection, and none being opened. */
  AGENT_BROKER_DISCONNECTED = 1,
  /** Connection opened; its subscription is not acknowledged yet. */
  AGENT_BROKER_CONNECTING,
  /** Subscribed to the Wake-up topic: Wake-ups are heard. */
  AGENT_BROKER_SUBSCRIBED,
} AgentBrokerState;

/** What `AGENT_TASK_SYNC_BROKER` asks the agent to do with the connection. */
typedef enum {
  AGENT_BROKER_ACTION_NONE = 1,
  /** The Device is no longer active in an Organization: close the connection. */
  AGENT_BROKER_ACTION_DROP,
  /** The Organization changed: subscribe to the new topic, not the old one. */
  AGENT_BROKER_ACTION_RESUBSCRIBE,
  /** The handshake took too long: treat the connection as lost. */
  AGENT_BROKER_ACTION_TIME_OUT,
} AgentBrokerAction;

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

  /**
   * Wake-up broker connection. While disconnected, `nextBrokerAttemptAt` is
   * when the next attempt is due; while connecting, it is the handshake
   * deadline.
   */
  AgentBrokerState brokerState;
  uint64_t         nextBrokerAttemptAt;
  uint32_t         brokerFailureCount;

  /** Organization whose topic the connection is (being) subscribed to. */
  char brokerOrganizationId[PROTOCOL_ORGANIZATION_ID_CAPACITY];

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

  /** A Wake-up was heard: while active, a Command fetch is due now. */
  AgentSchedule (*const wakeupHeard)(const AgentSchedule *schedule, uint64_t now);

  /**
   * The attempt to open the broker connection finished. On success the
   * subscription is awaited (the handshake deadline starts); on failure the
   * next attempt backs off exponentially with jitter.
   */
  AgentSchedule (*const brokerConnectFinished)(
    const AgentSchedule *schedule,
    bool                 succeeded,
    uint64_t             now,
    uint32_t             randomValue
  );

  /**
   * The broker acknowledged the subscription: Wake-ups are heard from now on,
   * the backoff resets, and a Command fetch is due now to catch every
   * Wake-up sent while the Device could not hear them.
   */
  AgentSchedule (*const brokerSubscribed)(const AgentSchedule *schedule, uint64_t now);

  /** The connection was lost, or timed out: back off before connecting again. */
  AgentSchedule (*const brokerLost)(
    const AgentSchedule *schedule, uint64_t now, uint32_t randomValue
  );

  /** The agent closed the connection on purpose; not an outage, no backoff. */
  AgentSchedule (*const brokerDropped)(const AgentSchedule *schedule, uint64_t now);

  /**
   * The agent moved the subscription to the current Organization's topic;
   * its acknowledgement is awaited like a first subscription's.
   */
  AgentSchedule (*const brokerRetargeted)(const AgentSchedule *schedule, uint64_t now);

  /** What `AGENT_TASK_SYNC_BROKER` is due for at `now`. */
  AgentBrokerAction (*const brokerAction)(const AgentSchedule *schedule, uint64_t now);

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
