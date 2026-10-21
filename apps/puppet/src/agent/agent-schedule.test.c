#include "agent/agent-schedule.h"
#include "testing/testing.h"

#include <string.h>

/** Arbitrary monotonic start time, away from zero to expose offset bugs. */
#define AGENT_TEST_START_TIME ((uint64_t)1000)

static DeviceState agentTestDeviceState(
  const DeviceStatus status, const char *organizationId
) {
  DeviceState state = {
    .status          = status,
    .hasOrganization = organizationId != NULL,
    .organizationId  = "",
    .name            = "",
  };
  if (organizationId != NULL) {
    strcpy(state.organizationId, organizationId);
  }
  return state;
}

static AgentSchedule agentTestActiveSchedule(const uint64_t now) {
  const AgentSchedule created = AgentScheduleI.create(true, now);
  const DeviceState   active  = agentTestDeviceState(DEVICE_STATUS_ACTIVE, "org-9");
  return AgentScheduleI.deviceStateReceived(&created, &active, now);
}

/** Active, with the Wake-up broker connected and subscribed. */
static AgentSchedule agentTestSubscribedSchedule(const uint64_t now) {
  AgentSchedule schedule = agentTestActiveSchedule(now);
  schedule               = AgentScheduleI.brokerConnectFinished(&schedule, true, now, 0);
  return AgentScheduleI.brokerSubscribed(&schedule, now);
}

static void agentScheduleStartsUnenrolledWithoutCredentials(TestContext *context) {
  const AgentSchedule schedule =
    AgentScheduleI.create(false, AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_UNENROLLED);
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME) == AGENT_TASK_CONNECT
  );
}

static void agentScheduleChecksStatusWithStoredCredentials(TestContext *context) {
  const AgentSchedule schedule =
    AgentScheduleI.create(true, AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_PENDING);
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME)
      == (AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT)
  );
}

static void agentScheduleBacksOffConnectFailures(TestContext *context) {
  AgentSchedule schedule = AgentScheduleI.create(false, AGENT_TEST_START_TIME);

  schedule = AgentScheduleI.connectFailed(&schedule, AGENT_TEST_START_TIME, 0);
  EXPECT(
    context,
    schedule.nextConnectAt
      == AGENT_TEST_START_TIME + AGENT_CONNECT_BACKOFF_BASE_SECONDS
  );
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1) == 0
  );

  schedule = AgentScheduleI.connectFailed(&schedule, AGENT_TEST_START_TIME, 0);
  EXPECT(
    context,
    schedule.nextConnectAt
      == AGENT_TEST_START_TIME + 2 * AGENT_CONNECT_BACKOFF_BASE_SECONDS
  );

  for (uint32_t attempt = 0; attempt < 20; attempt++) {
    schedule = AgentScheduleI.connectFailed(&schedule, AGENT_TEST_START_TIME, 0);
  }
  EXPECT(
    context,
    schedule.nextConnectAt
      == AGENT_TEST_START_TIME + AGENT_CONNECT_BACKOFF_MAX_SECONDS
  );
}

static void agentScheduleJittersConnectRetries(TestContext *context) {
  const AgentSchedule created = AgentScheduleI.create(false, AGENT_TEST_START_TIME);
  const AgentSchedule jittered =
    AgentScheduleI.connectFailed(&created, AGENT_TEST_START_TIME, UINT32_MAX);
  const uint64_t delay = jittered.nextConnectAt - AGENT_TEST_START_TIME;

  EXPECT(context, delay >= AGENT_CONNECT_BACKOFF_BASE_SECONDS);
  EXPECT(
    context,
    delay <= AGENT_CONNECT_BACKOFF_BASE_SECONDS
               + AGENT_CONNECT_BACKOFF_BASE_SECONDS / 2
  );
}

static void agentScheduleResetsBackoffOnConnect(TestContext *context) {
  AgentSchedule schedule = AgentScheduleI.create(false, AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.connectFailed(&schedule, AGENT_TEST_START_TIME, 0);
  schedule = AgentScheduleI.connected(&schedule, AGENT_TEST_START_TIME + 50);

  EXPECT(context, schedule.phase == AGENT_PHASE_PENDING);
  EXPECT(context, schedule.connectFailureCount == 0);
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 50)
      == (AGENT_TASK_CHECK_STATUS | AGENT_TASK_HEARTBEAT)
  );
}

static void agentScheduleWaitsWhilePending(TestContext *context) {
  const AgentSchedule created = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  const DeviceState   pending = agentTestDeviceState(DEVICE_STATUS_PENDING, NULL);
  const AgentSchedule schedule =
    AgentScheduleI.deviceStateReceived(&created, &pending, AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_PENDING);
  EXPECT(
    context,
    schedule.nextStatusCheckAt
      == AGENT_TEST_START_TIME + AGENT_PENDING_STATUS_INTERVAL_SECONDS
  );
  /** Pending Devices never fetch Commands nor a feed. */
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, UINT64_MAX)
     & (AGENT_TASK_FETCH_COMMANDS | AGENT_TASK_REFRESH_FEED))
      == 0
  );
}

static void agentScheduleStartsWorkWhenApproved(TestContext *context) {
  const AgentSchedule schedule = agentTestActiveSchedule(AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_ACTIVE);
  EXPECT(context, strcmp(schedule.organizationId, "org-9") == 0);
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME)
      == (AGENT_TASK_HEARTBEAT | AGENT_TASK_FETCH_COMMANDS | AGENT_TASK_REFRESH_FEED
          | AGENT_TASK_CONNECT_BROKER)
  );
}

/** A year of seconds: far beyond any timer, yet below `AGENT_NEVER_DUE`. */
#define AGENT_TEST_LONG_WAIT_SECONDS ((uint64_t)365 * 24 * 3600)

static void agentScheduleNeverFetchesCommandsOnATimer(TestContext *context) {
  const AgentPhase phases[] = {
    AGENT_PHASE_UNENROLLED,
    AGENT_PHASE_PENDING,
    AGENT_PHASE_ACTIVE,
    AGENT_PHASE_REJECTED,
  };
  AgentSchedule active = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  active = AgentScheduleI.taskFinished(
    &active, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );

  for (uint32_t index = 0; index < sizeof(phases) / sizeof(phases[0]); index++) {
    AgentSchedule schedule = active;
    schedule.phase         = phases[index];
    EXPECT(
      context,
      (AgentScheduleI.dueTasks(
         &schedule, AGENT_TEST_START_TIME + AGENT_TEST_LONG_WAIT_SECONDS
       )
       & AGENT_TASK_FETCH_COMMANDS)
        == 0
    );
  }

  const AgentSchedule failed = AgentScheduleI.taskFinished(
    &active, AGENT_TASK_FETCH_COMMANDS, false, AGENT_TEST_START_TIME
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(
       &failed, AGENT_TEST_START_TIME + AGENT_TEST_LONG_WAIT_SECONDS
     )
     & AGENT_TASK_FETCH_COMMANDS)
      == 0
  );
}

static void agentScheduleFetchesCommandsOnBoot(TestContext *context) {
  const AgentSchedule created = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  const DeviceState   active  = agentTestDeviceState(DEVICE_STATUS_ACTIVE, "org-9");
  const AgentSchedule schedule =
    AgentScheduleI.deviceStateReceived(&created, &active, AGENT_TEST_START_TIME);

  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME)
     & AGENT_TASK_FETCH_COMMANDS)
      != 0
  );
}

static void agentScheduleFetchesCommandsWhenTheHeartbeatSaysTheyWait(
  TestContext *context
) {
  AgentSchedule schedule = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );
  const uint64_t later = AGENT_TEST_START_TIME + AGENT_HEARTBEAT_INTERVAL_SECONDS;

  const AgentSchedule idle =
    AgentScheduleI.heartbeatAnswered(&schedule, false, later);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&idle, later) & AGENT_TASK_FETCH_COMMANDS) == 0
  );

  const AgentSchedule waiting =
    AgentScheduleI.heartbeatAnswered(&schedule, true, later);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&waiting, later) & AGENT_TASK_FETCH_COMMANDS) != 0
  );

  const AgentSchedule fetched = AgentScheduleI.taskFinished(
    &waiting, AGENT_TASK_FETCH_COMMANDS, true, later
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&fetched, later + 1) & AGENT_TASK_FETCH_COMMANDS)
      == 0
  );
}

static void agentScheduleIgnoresTheWaitingFlagOutsideTheActivePhase(
  TestContext *context
) {
  const AgentSchedule created = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  const DeviceState   pending = agentTestDeviceState(DEVICE_STATUS_PENDING, NULL);
  AgentSchedule       schedule =
    AgentScheduleI.deviceStateReceived(&created, &pending, AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );

  const AgentSchedule answered = AgentScheduleI.heartbeatAnswered(
    &schedule, true, AGENT_TEST_START_TIME + 1
  );
  EXPECT(
    context,
    answered.nextCommandFetchAt == schedule.nextCommandFetchAt
  );
}

static void agentScheduleFetchesCommandsWhenAWakeupIsHeard(TestContext *context) {
  AgentSchedule schedule = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
     & AGENT_TASK_FETCH_COMMANDS)
      == 0
  );

  const AgentSchedule heard =
    AgentScheduleI.wakeupHeard(&schedule, AGENT_TEST_START_TIME + 1);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&heard, AGENT_TEST_START_TIME + 1)
     & AGENT_TASK_FETCH_COMMANDS)
      != 0
  );

  /** A duplicate Wake-up costs one extra fetch, never more. */
  const AgentSchedule twice =
    AgentScheduleI.wakeupHeard(&heard, AGENT_TEST_START_TIME + 1);
  const AgentSchedule fetched = AgentScheduleI.taskFinished(
    &twice, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME + 1
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&fetched, AGENT_TEST_START_TIME + 2)
     & AGENT_TASK_FETCH_COMMANDS)
      == 0
  );
}

static void agentScheduleIgnoresAWakeupOutsideTheActivePhase(TestContext *context) {
  const AgentSchedule created = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  const DeviceState   pending = agentTestDeviceState(DEVICE_STATUS_PENDING, NULL);
  AgentSchedule       schedule =
    AgentScheduleI.deviceStateReceived(&created, &pending, AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );

  const AgentSchedule heard =
    AgentScheduleI.wakeupHeard(&schedule, AGENT_TEST_START_TIME + 1);
  EXPECT(context, heard.nextCommandFetchAt == schedule.nextCommandFetchAt);
}

static void agentScheduleConnectsTheBrokerOnlyWhenActiveInAnOrganization(
  TestContext *context
) {
  const AgentSchedule created = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&created, AGENT_TEST_START_TIME)
     & AGENT_TASK_CONNECT_BROKER)
      == 0
  );

  const DeviceState   pending = agentTestDeviceState(DEVICE_STATUS_PENDING, NULL);
  const AgentSchedule waiting =
    AgentScheduleI.deviceStateReceived(&created, &pending, AGENT_TEST_START_TIME);
  const DeviceState   rejected = agentTestDeviceState(DEVICE_STATUS_REJECTED, NULL);
  const AgentSchedule refused =
    AgentScheduleI.deviceStateReceived(&created, &rejected, AGENT_TEST_START_TIME);
  const DeviceState   homeless = agentTestDeviceState(DEVICE_STATUS_ACTIVE, NULL);
  const AgentSchedule orphan =
    AgentScheduleI.deviceStateReceived(&created, &homeless, AGENT_TEST_START_TIME);
  const AgentSchedule unenrolled = AgentScheduleI.create(false, AGENT_TEST_START_TIME);
  const AgentSchedule others[]   = {waiting, refused, orphan, unenrolled};
  for (uint32_t index = 0; index < sizeof(others) / sizeof(others[0]); index++) {
    EXPECT(
      context,
      (AgentScheduleI.dueTasks(&others[index], AGENT_TEST_START_TIME)
       & AGENT_TASK_CONNECT_BROKER)
        == 0
    );
  }

  const AgentSchedule active = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&active, AGENT_TEST_START_TIME)
     & AGENT_TASK_CONNECT_BROKER)
      != 0
  );
}

static void agentScheduleFetchesCommandsAfterEverySubscription(TestContext *context) {
  AgentSchedule schedule = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );

  const uint64_t lostAt = AGENT_TEST_START_TIME + 100;
  schedule              = AgentScheduleI.brokerLost(&schedule, lostAt, 0);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, lostAt) & AGENT_TASK_FETCH_COMMANDS) == 0
  );

  const uint64_t restoredAt = lostAt + AGENT_BROKER_BACKOFF_BASE_SECONDS;
  schedule = AgentScheduleI.brokerConnectFinished(&schedule, true, restoredAt, 0);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, restoredAt) & AGENT_TASK_FETCH_COMMANDS) == 0
  );
  schedule = AgentScheduleI.brokerSubscribed(&schedule, restoredAt + 1);
  /** Wake-ups sent while disconnected are caught by this one fetch. */
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, restoredAt + 1) & AGENT_TASK_FETCH_COMMANDS)
      != 0
  );
}

static void agentScheduleBacksOffBrokerReconnects(TestContext *context) {
  AgentSchedule schedule = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  uint64_t      now      = AGENT_TEST_START_TIME;

  schedule = AgentScheduleI.brokerLost(&schedule, now, 0);
  EXPECT(
    context,
    schedule.nextBrokerAttemptAt == now + AGENT_BROKER_BACKOFF_BASE_SECONDS
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, now + AGENT_BROKER_BACKOFF_BASE_SECONDS - 1)
     & AGENT_TASK_CONNECT_BROKER)
      == 0
  );

  uint64_t expectedDelay = AGENT_BROKER_BACKOFF_BASE_SECONDS;
  for (uint32_t attempt = 0; attempt < 12; attempt++) {
    now      = schedule.nextBrokerAttemptAt;
    schedule = AgentScheduleI.brokerConnectFinished(&schedule, false, now, 0);
    expectedDelay =
      expectedDelay * 2 < AGENT_BROKER_BACKOFF_MAX_SECONDS
        ? expectedDelay * 2
        : AGENT_BROKER_BACKOFF_MAX_SECONDS;
    EXPECT(context, schedule.nextBrokerAttemptAt == now + expectedDelay);
  }
  EXPECT(context, expectedDelay == AGENT_BROKER_BACKOFF_MAX_SECONDS);

  /** A broker that comes back resets the backoff. */
  now      = schedule.nextBrokerAttemptAt;
  schedule = AgentScheduleI.brokerConnectFinished(&schedule, true, now, 0);
  schedule = AgentScheduleI.brokerSubscribed(&schedule, now);
  schedule = AgentScheduleI.brokerLost(&schedule, now, 0);
  EXPECT(
    context,
    schedule.nextBrokerAttemptAt == now + AGENT_BROKER_BACKOFF_BASE_SECONDS
  );
}

static void agentScheduleGivesUpOnAHandshakeThatNeverFinishes(TestContext *context) {
  AgentSchedule schedule = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.brokerConnectFinished(&schedule, true, AGENT_TEST_START_TIME, 0);

  const uint64_t deadline = AGENT_TEST_START_TIME + AGENT_BROKER_HANDSHAKE_TIMEOUT_SECONDS;
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&schedule, deadline - 1) == AGENT_BROKER_ACTION_NONE
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, deadline - 1) & AGENT_TASK_SYNC_BROKER) == 0
  );
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&schedule, deadline) == AGENT_BROKER_ACTION_TIME_OUT
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, deadline) & AGENT_TASK_SYNC_BROKER) != 0
  );
}

static void agentScheduleResubscribesWhenTheOrganizationChanges(TestContext *context) {
  AgentSchedule schedule = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&schedule, AGENT_TEST_START_TIME)
      == AGENT_BROKER_ACTION_NONE
  );

  const DeviceState moved = agentTestDeviceState(DEVICE_STATUS_ACTIVE, "org-2");
  schedule                = AgentScheduleI.deviceStateReceived(
    &schedule, &moved, AGENT_TEST_START_TIME + 1
  );
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&schedule, AGENT_TEST_START_TIME + 1)
      == AGENT_BROKER_ACTION_RESUBSCRIBE
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
     & AGENT_TASK_SYNC_BROKER)
      != 0
  );

  schedule = AgentScheduleI.brokerRetargeted(&schedule, AGENT_TEST_START_TIME + 1);
  EXPECT(context, strcmp(schedule.brokerOrganizationId, "org-2") == 0);
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&schedule, AGENT_TEST_START_TIME + 1)
      == AGENT_BROKER_ACTION_NONE
  );

  /** The new topic is confirmed by its own subscription acknowledgement. */
  schedule = AgentScheduleI.brokerSubscribed(&schedule, AGENT_TEST_START_TIME + 2);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 2)
     & AGENT_TASK_FETCH_COMMANDS)
      != 0
  );
}

static void agentScheduleDropsTheBrokerWhenLeavingTheActivePhase(TestContext *context) {
  const AgentSchedule subscribed = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  const DeviceState   pending    = agentTestDeviceState(DEVICE_STATUS_PENDING, NULL);
  const DeviceState   rejected   = agentTestDeviceState(DEVICE_STATUS_REJECTED, NULL);
  const DeviceState   homeless   = agentTestDeviceState(DEVICE_STATUS_ACTIVE, NULL);

  const DeviceState *const states[] = {&pending, &rejected, &homeless};
  for (uint32_t index = 0; index < sizeof(states) / sizeof(states[0]); index++) {
    AgentSchedule schedule = AgentScheduleI.deviceStateReceived(
      &subscribed, states[index], AGENT_TEST_START_TIME + 1
    );
    EXPECT(
      context,
      AgentScheduleI.brokerAction(&schedule, AGENT_TEST_START_TIME + 1)
        == AGENT_BROKER_ACTION_DROP
    );
    EXPECT(
      context,
      (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
       & AGENT_TASK_SYNC_BROKER)
        != 0
    );

    schedule = AgentScheduleI.brokerDropped(&schedule, AGENT_TEST_START_TIME + 1);
    EXPECT(
      context,
      AgentScheduleI.brokerAction(&schedule, AGENT_TEST_START_TIME + 1)
        == AGENT_BROKER_ACTION_NONE
    );
    EXPECT(
      context,
      (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
       & (AGENT_TASK_SYNC_BROKER | AGENT_TASK_CONNECT_BROKER))
        == 0
    );
  }

  const AgentSchedule revoked =
    AgentScheduleI.credentialsRevoked(&subscribed, AGENT_TEST_START_TIME + 1);
  EXPECT(
    context,
    AgentScheduleI.brokerAction(&revoked, AGENT_TEST_START_TIME + 1)
      == AGENT_BROKER_ACTION_DROP
  );
}

static void agentScheduleConnectsAgainRightAfterADeliberateDrop(TestContext *context) {
  const AgentSchedule subscribed = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  const AgentSchedule dropped =
    AgentScheduleI.brokerDropped(&subscribed, AGENT_TEST_START_TIME + 5);

  /** Dropping is not an outage: once the Device is active again it connects at once. */
  EXPECT(context, dropped.brokerFailureCount == 0);
  EXPECT(context, dropped.nextBrokerAttemptAt <= AGENT_TEST_START_TIME + 5);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&dropped, AGENT_TEST_START_TIME + 5)
     & AGENT_TASK_CONNECT_BROKER)
      != 0
  );
}

static void agentScheduleTreatsOfflineAsActive(TestContext *context) {
  const AgentSchedule active = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  const DeviceState   offline = agentTestDeviceState(DEVICE_STATUS_OFFLINE, "org-9");
  const AgentSchedule schedule =
    AgentScheduleI.deviceStateReceived(&active, &offline, AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_ACTIVE);
}

static void agentScheduleRefreshesFeedOnOrganizationMove(TestContext *context) {
  AgentSchedule schedule = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_REFRESH_FEED, true, AGENT_TEST_START_TIME
  );
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
     & AGENT_TASK_REFRESH_FEED)
      == 0
  );

  const DeviceState moved = agentTestDeviceState(DEVICE_STATUS_ACTIVE, "org-2");
  schedule = AgentScheduleI.deviceStateReceived(
    &schedule, &moved, AGENT_TEST_START_TIME + 1
  );
  EXPECT(context, strcmp(schedule.organizationId, "org-2") == 0);
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 1)
     & AGENT_TASK_REFRESH_FEED)
      != 0
  );
}

static void agentScheduleRetriesFailedFeedSooner(TestContext *context) {
  const AgentSchedule active = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  const AgentSchedule failed = AgentScheduleI.taskFinished(
    &active, AGENT_TASK_REFRESH_FEED, false, AGENT_TEST_START_TIME
  );
  const AgentSchedule succeeded = AgentScheduleI.taskFinished(
    &active, AGENT_TASK_REFRESH_FEED, true, AGENT_TEST_START_TIME
  );

  EXPECT(
    context,
    failed.nextFeedRefreshAt
      == AGENT_TEST_START_TIME + AGENT_FEED_RETRY_INTERVAL_SECONDS
  );
  EXPECT(
    context,
    succeeded.nextFeedRefreshAt
      == AGENT_TEST_START_TIME + AGENT_FEED_REFRESH_INTERVAL_SECONDS
  );
}

static void agentScheduleGoesQuietWhenRejected(TestContext *context) {
  const AgentSchedule created  = AgentScheduleI.create(true, AGENT_TEST_START_TIME);
  const DeviceState   rejected = agentTestDeviceState(DEVICE_STATUS_REJECTED, NULL);
  const AgentSchedule schedule =
    AgentScheduleI.deviceStateReceived(&created, &rejected, AGENT_TEST_START_TIME);

  EXPECT(context, schedule.phase == AGENT_PHASE_REJECTED);
  EXPECT(
    context,
    AgentScheduleI.secondsUntilNextTask(&schedule, AGENT_TEST_START_TIME)
      == AGENT_REJECTED_STATUS_INTERVAL_SECONDS
  );
}

static void agentScheduleReenrollsWhenRevoked(TestContext *context) {
  const AgentSchedule active = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  const AgentSchedule schedule =
    AgentScheduleI.credentialsRevoked(&active, AGENT_TEST_START_TIME + 5);

  EXPECT(context, schedule.phase == AGENT_PHASE_UNENROLLED);
  EXPECT(context, !schedule.hasOrganization);
  EXPECT(
    context,
    AgentScheduleI.dueTasks(&schedule, AGENT_TEST_START_TIME + 5)
      == AGENT_TASK_CONNECT
  );
}

static void agentScheduleSleepsUntilEarliestTask(TestContext *context) {
  AgentSchedule schedule = agentTestSubscribedSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_HEARTBEAT, true, AGENT_TEST_START_TIME
  );
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_FETCH_COMMANDS, true, AGENT_TEST_START_TIME
  );
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_REFRESH_FEED, true, AGENT_TEST_START_TIME
  );

  EXPECT(
    context,
    AgentScheduleI.secondsUntilNextTask(&schedule, AGENT_TEST_START_TIME)
      == AGENT_HEARTBEAT_INTERVAL_SECONDS
  );
  EXPECT(
    context,
    AgentScheduleI.secondsUntilNextTask(&schedule, UINT64_MAX) == 0
  );
}

static const TestCase AGENT_SCHEDULE_TEST_CASES[] = {
  {"starts unenrolled without credentials",
   agentScheduleStartsUnenrolledWithoutCredentials},
  {"checks status first when credentials are stored",
   agentScheduleChecksStatusWithStoredCredentials},
  {"backs off connect failures exponentially up to the cap",
   agentScheduleBacksOffConnectFailures},
  {"jitters connect retries by at most half the delay",
   agentScheduleJittersConnectRetries},
  {"resets the backoff once connected", agentScheduleResetsBackoffOnConnect},
  {"only checks status and heartbeats while pending",
   agentScheduleWaitsWhilePending},
  {"fetches Commands and the feed when approved",
   agentScheduleStartsWorkWhenApproved},
  {"never fetches Commands on a timer, in any phase",
   agentScheduleNeverFetchesCommandsOnATimer},
  {"fetches Commands once on boot", agentScheduleFetchesCommandsOnBoot},
  {"fetches Commands when a heartbeat says they wait",
   agentScheduleFetchesCommandsWhenTheHeartbeatSaysTheyWait},
  {"ignores the waiting flag outside the active phase",
   agentScheduleIgnoresTheWaitingFlagOutsideTheActivePhase},
  {"fetches Commands when a Wake-up is heard",
   agentScheduleFetchesCommandsWhenAWakeupIsHeard},
  {"ignores a Wake-up outside the active phase",
   agentScheduleIgnoresAWakeupOutsideTheActivePhase},
  {"connects the broker only when active in an Organization",
   agentScheduleConnectsTheBrokerOnlyWhenActiveInAnOrganization},
  {"fetches Commands after every successful subscription",
   agentScheduleFetchesCommandsAfterEverySubscription},
  {"backs off broker reconnects without hammering the broker",
   agentScheduleBacksOffBrokerReconnects},
  {"gives up on a broker handshake that never finishes",
   agentScheduleGivesUpOnAHandshakeThatNeverFinishes},
  {"resubscribes when the Organization changes",
   agentScheduleResubscribesWhenTheOrganizationChanges},
  {"drops the broker when leaving the active phase",
   agentScheduleDropsTheBrokerWhenLeavingTheActivePhase},
  {"connects again right after a deliberate drop",
   agentScheduleConnectsAgainRightAfterADeliberateDrop},
  {"keeps working when Puppeteer reports it offline",
   agentScheduleTreatsOfflineAsActive},
  {"refreshes the feed when moved to another organization",
   agentScheduleRefreshesFeedOnOrganizationMove},
  {"retries a failed feed refresh sooner", agentScheduleRetriesFailedFeedSooner},
  {"checks status only hourly when rejected", agentScheduleGoesQuietWhenRejected},
  {"enrolls again when credentials are revoked", agentScheduleReenrollsWhenRevoked},
  {"sleeps until the earliest due task", agentScheduleSleepsUntilEarliestTask},
};

static const TestSuite AgentScheduleTestSuite = {
  .name      = "agent-schedule",
  .cases     = AGENT_SCHEDULE_TEST_CASES,
  .caseCount = sizeof(AGENT_SCHEDULE_TEST_CASES) / sizeof(AGENT_SCHEDULE_TEST_CASES[0]),
};
