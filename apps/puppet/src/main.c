#define DSRS_MMKV_IMPLEMENTATION
#include "mmkv/mmkv.h"

#define DSRS_STATS_IMPLEMENTATION
#include "stats/stats.h"

#define PUPPET_HTTP_CLIENT_IMPLEMENTATION
#include "http/http-client.h"

#define PUPPET_JSON_IMPLEMENTATION
#include "json/json.h"

#define PUPPET_SHA256_IMPLEMENTATION
#include "crypto/sha256.h"

#define PUPPET_PROTOCOL_IMPLEMENTATION
#include "protocol/protocol.h"

#define PUPPET_CONFIG_IMPLEMENTATION
#include "config/config.h"

#define PUPPET_LIFECYCLE_IMPLEMENTATION
#include "lifecycle/lifecycle.h"

#define PUPPET_DEVICE_STORE_IMPLEMENTATION
#include "device-store/device-store.h"

#define PUPPET_COMMAND_EXECUTOR_IMPLEMENTATION
#include "commands/command-executor.h"

#define PUPPET_SELF_UPDATE_IMPLEMENTATION
#include "update/self-update.h"

#define PUPPET_INSTALLATION_IMPLEMENTATION
#include "installation/installation.h"

#define PUPPET_AUDIT_TRAIL_IMPLEMENTATION
#include "audit-trail/audit-trail.h"

#define PUPPET_INSTALLER_IMPLEMENTATION
#include "installer/installer.h"

#define PUPPET_AGENT_LOCK_IMPLEMENTATION
#include "agent-lock/agent-lock.h"

#define PUPPET_AGENT_SCHEDULE_IMPLEMENTATION
#include "agent/agent-schedule.h"

#define PUPPET_AGENT_IMPLEMENTATION
#include "agent/agent.h"

#include <stdio.h>
#include <string.h>

/** Process exit statuses, distinct per failure so supervisors can tell. */
typedef enum {
  PUPPET_EXIT_SUCCESS                 = 0,
  PUPPET_EXIT_INVALID_CONFIGURATION   = 1,
  PUPPET_EXIT_HTTP_INITIALIZATION     = 2,
  PUPPET_EXIT_HTTP_CLIENT_ALLOCATION  = 3,
  PUPPET_EXIT_STORAGE_INITIALIZATION  = 4,
  PUPPET_EXIT_RESTART_FAILED          = 5,
  /** Another agent already holds the agent lock. */
  PUPPET_EXIT_AGENT_ALREADY_RUNNING   = 6,
  /** The agent lock could not be opened or locked at all. */
  PUPPET_EXIT_AGENT_LOCK_UNAVAILABLE  = 7,
  /** The running executable's path could not be determined. */
  PUPPET_EXIT_EXECUTABLE_UNKNOWN      = 8,
  /** Installing needs root and `sudo` or `su` could not be started. */
  PUPPET_EXIT_SUDO_UNAVAILABLE        = 9,
  /** An installation step failed; the steps already done are in the trail. */
  PUPPET_EXIT_INSTALLATION_FAILED     = 10,
} PuppetExitStatus;

static const char *configErrorDescription(const ConfigResultCode code) {
  switch (code) {
  case CONFIG_ERROR_MISSING_SERVER_URL:
    return "the Puppeteer URL baked into this build is empty";
  case CONFIG_ERROR_INVALID_SERVER_URL:
    return "the Puppeteer URL baked into this build must start with http:// or https://";
  case CONFIG_ERROR_SERVER_URL_TOO_LONG:
    return "the Puppeteer URL baked into this build is too long";
  case CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER:
    return "/etc/machine-id is missing or empty";
  case CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG:
    return "/etc/machine-id is too long";
  case CONFIG_RESULT_OK:
    break;
  }
  return "unknown configuration error";
}

static PuppetExitStatus installerExitStatus(const InstallerResultCode code) {
  switch (code) {
  case INSTALLER_RESULT_OK:
    return PUPPET_EXIT_SUCCESS;
  case INSTALLER_ERROR_SUDO_UNAVAILABLE:
  case INSTALLER_ERROR_SU_UNAVAILABLE:
    return PUPPET_EXIT_SUDO_UNAVAILABLE;
  default:
    break;
  }
  return PUPPET_EXIT_INSTALLATION_FAILED;
}

int main(const int argumentCount, char *argumentValues[]) {
  /** The Installation asks the installed binary which version it is. */
  if (argumentCount == 2 && strcmp(argumentValues[1], INSTALLER_VERSION_OPTION) == 0) {
    printf("%s\n", PUPPET_VERSION);
    return PUPPET_EXIT_SUCCESS;
  }

  /**
   * Resolved now: once an update replaces the binary, the kernel no
   * longer reports its original path.
   */
  SelfUpdatePaths            updatePaths;
  const SelfUpdateResultCode pathsCode = SelfUpdateI.resolvePaths(&updatePaths);
  if (pathsCode != SELF_UPDATE_RESULT_OK) {
    fprintf(
      stderr, "[error] cannot locate the running executable (%d)\n", pathsCode
    );
    return PUPPET_EXIT_EXECUTABLE_UNKNOWN;
  }

  /**
   * Before the lifecycle blocks the termination signals: a terminal run must
   * stay interruptible, and it never takes the agent lock.
   */
  const InstallationEnvironment installationEnvironment =
    InstallationI.readEnvironment();
  const InstallationInputs installationInputs = {
    .invocationIdentifier = installationEnvironment.invocationIdentifier,
    .executablePath       = updatePaths.executablePath,
  };
  if (InstallationI.decideRole(&installationInputs) == INSTALLATION_ROLE_TERMINAL) {
    const InstallerContext installerContext = {
      .executablePath = updatePaths.executablePath,
      .sudoUser       = installationEnvironment.sudoUser,
      .puppetVersion  = PUPPET_VERSION,
    };
    return installerExitStatus(InstallerI.run(&installerContext));
  }

  /** Block termination signals before anything else (see lifecycle.h). */
  const Lifecycle lifecycle = LifecycleI.create();

  char puppetStartTime[LIFECYCLE_TIMESTAMP_CAPACITY];
  LifecycleI.formatUtcNow(puppetStartTime);

  /** Before anything touches storage: two agents must never share it. */
  const AgentLockResultCode lockCode = AgentLockI.acquire(CONFIG_AGENT_LOCK_PATH);
  if (lockCode == AGENT_LOCK_ERROR_HELD) {
    fprintf(
      stderr,
      "[error] another agent is already running (lock %s is held)\n",
      CONFIG_AGENT_LOCK_PATH
    );
    return PUPPET_EXIT_AGENT_ALREADY_RUNNING;
  }
  if (lockCode != AGENT_LOCK_RESULT_OK) {
    fprintf(
      stderr,
      "[error] cannot take the agent lock %s (%d)\n",
      CONFIG_AGENT_LOCK_PATH,
      lockCode
    );
    return PUPPET_EXIT_AGENT_LOCK_UNAVAILABLE;
  }

  ConfigSourceStorage    sourceStorage;
  const ConfigSources    sources = ConfigI.readSources(&sourceStorage);
  PuppetConfig           config;
  const ConfigResultCode configCode = ConfigI.resolve(&sources, &config);
  if (configCode != CONFIG_RESULT_OK) {
    fprintf(
      stderr,
      "[error] invalid configuration (%d): %s\n",
      configCode,
      configErrorDescription(configCode)
    );
    return PUPPET_EXIT_INVALID_CONFIGURATION;
  }

  MmkvI.initialize(CONFIG_DATA_DIRECTORY);
  MMKVHandle_t storage = MmkvI.createDefault();
  if (storage == NULL) {
    fprintf(
      stderr, "[error] cannot open storage in %s\n", CONFIG_DATA_DIRECTORY
    );
    MmkvI.shutdown();
    return PUPPET_EXIT_STORAGE_INITIALIZATION;
  }

  const HttpResult httpInitialization = HttpClientI.initialize();
  if (httpInitialization.code != HTTP_RESULT_OK) {
    fprintf(
      stderr,
      "[error] cannot initialize HTTP (curl code %d)\n",
      httpInitialization.curlCode
    );
    MmkvI.shutdown();
    return PUPPET_EXIT_HTTP_INITIALIZATION;
  }

  HttpClient *httpClient = HttpClientI.create(config.serverUrl);
  if (httpClient == NULL) {
    fprintf(stderr, "[error] cannot allocate the HTTP client\n");
    HttpClientI.cleanup();
    MmkvI.shutdown();
    return PUPPET_EXIT_HTTP_CLIENT_ALLOCATION;
  }

  const AgentEnvironment environment = {
    .config          = &config,
    .httpClient      = httpClient,
    .storage         = storage,
    .lifecycle       = &lifecycle,
    .auditTrailPath  = CONFIG_AUDIT_TRAIL_PATH,
    .puppetVersion   = PUPPET_VERSION,
    .puppetStartTime = puppetStartTime,
    .updatePaths     = &updatePaths,
  };
  const AgentExitReason exitReason = AgentI.run(&environment);

  HttpClientI.destroy(httpClient);
  HttpClientI.cleanup();
  MmkvI.shutdown();

  if (exitReason == AGENT_EXIT_RESTART_REQUESTED) {
    const AgentLockResultCode keepCode = AgentLockI.keepAcrossRestart();
    if (keepCode != AGENT_LOCK_RESULT_OK) {
      fprintf(
        stderr, "[error] cannot keep the agent lock across the restart (%d)\n", keepCode
      );
      return PUPPET_EXIT_RESTART_FAILED;
    }
    SelfUpdateI.restart(&updatePaths, argumentValues);
    fprintf(stderr, "[error] restart into the updated binary failed\n");
    return PUPPET_EXIT_RESTART_FAILED;
  }
  return PUPPET_EXIT_SUCCESS;
}
