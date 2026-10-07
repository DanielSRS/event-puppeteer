/**
 * @file agent.h
 * @brief The Puppet's main loop: Enrollment, heartbeats, Commands and feed.
 *
 * The agent is the imperative shell around `agent-schedule.h`. Each
 * iteration it asks the schedule for the earliest due task, performs the
 * corresponding HTTP exchange with Puppeteer, and feeds the outcome back.
 * When nothing is due it sleeps until the next task, waking early on
 * termination signals.
 *
 * ## Device protocol used
 *
 * - `POST /devices/connect` — announce this Puppet (no auth).
 * - `GET  /devices/me` — read own Enrollment status and Organization.
 * - `POST /devices/:id/heartbeat` — liveness and recent errors.
 * - `POST /devices/:id/logs` — ship queued log lines.
 * - `GET  /devices/:id/commands/pending` — fetch Commands to run.
 * - `POST /devices/:id/commands/:cid/ack` then `.../complete`.
 * - `POST /devices/:id/telemetry` — answer `request_telemetry`.
 * - `GET  /organizations/:orgId/feed` — Events to display.
 *
 * Authenticated calls send `Authorization: Bearer <token>`. A 401 means the
 * credentials were revoked: they are discarded and the Puppet enrolls again.
 *
 * ## Logging
 *
 * Log lines go to standard error (picked up by journald) and are queued for
 * Puppeteer, flushed after each successful heartbeat. Errors are also listed
 * in the heartbeat itself.
 */
#ifndef PUPPET_AGENT_H_
#define PUPPET_AGENT_H_

#include "config/config.h"
#include "http/http-client.h"
#include "lifecycle/lifecycle.h"
#include "mmkv/mmkv.h"

/** Everything the agent needs from the outside world. Borrowed, not owned. */
typedef struct {
  const PuppetConfig *config;
  HttpClient         *httpClient;
  MMKVHandle_t        storage;
  const Lifecycle    *lifecycle;

  /** Version string of this build, e.g. "0.0.1". */
  const char *puppetVersion;

  /** ISO-8601 UTC time at which the process started. */
  const char *puppetStartTime;
} AgentEnvironment;

struct AgentType {
  /**
   * Run until a termination signal is received. Never returns early on
   * network or server errors: those are retried according to the schedule.
   */
  void (*const run)(const AgentEnvironment *environment);
};

extern const struct AgentType AgentI;

#ifdef PUPPET_AGENT_IMPLEMENTATION
#include "agent.c"
#endif

#endif // PUPPET_AGENT_H_
