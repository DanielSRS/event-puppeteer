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
  /** Pending Devices never poll Commands nor fetch a feed. */
  EXPECT(
    context,
    (AgentScheduleI.dueTasks(&schedule, UINT64_MAX)
     & (AGENT_TASK_POLL_COMMANDS | AGENT_TASK_REFRESH_FEED))
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
      == (AGENT_TASK_HEARTBEAT | AGENT_TASK_POLL_COMMANDS | AGENT_TASK_REFRESH_FEED)
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
  AgentSchedule schedule = agentTestActiveSchedule(AGENT_TEST_START_TIME);
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_HEARTBEAT, true, AGENT_TEST_START_TIME
  );
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_POLL_COMMANDS, true, AGENT_TEST_START_TIME
  );
  schedule = AgentScheduleI.taskFinished(
    &schedule, AGENT_TASK_REFRESH_FEED, true, AGENT_TEST_START_TIME
  );

  EXPECT(
    context,
    AgentScheduleI.secondsUntilNextTask(&schedule, AGENT_TEST_START_TIME)
      == AGENT_COMMAND_POLL_INTERVAL_SECONDS
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
  {"starts polling and fetching the feed when approved",
   agentScheduleStartsWorkWhenApproved},
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
