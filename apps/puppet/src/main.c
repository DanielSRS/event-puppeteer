#define DSRS_MMKV_IMPLEMENTATION
#include "mmkv/mmkv.h"

#define DSRS_STATS_IMPLEMENTATION
#include "stats/stats.h"

#define PUPPET_HTTP_CLIENT_IMPLEMENTATION
#include "http/http-client.h"

#define PUPPET_JSON_IMPLEMENTATION
#include "json/json.h"

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

#define PUPPET_AGENT_SCHEDULE_IMPLEMENTATION
#include "agent/agent-schedule.h"

#define PUPPET_AGENT_IMPLEMENTATION
#include "agent/agent.h"

#include <stdio.h>

/** Process exit statuses, distinct per failure so supervisors can tell. */
typedef enum {
  PUPPET_EXIT_SUCCESS                 = 0,
  PUPPET_EXIT_INVALID_CONFIGURATION   = 1,
  PUPPET_EXIT_HTTP_INITIALIZATION     = 2,
  PUPPET_EXIT_HTTP_CLIENT_ALLOCATION  = 3,
  PUPPET_EXIT_STORAGE_INITIALIZATION  = 4,
} PuppetExitStatus;

static const char *configErrorDescription(const ConfigResultCode code) {
  switch (code) {
  case CONFIG_ERROR_MISSING_SERVER_URL:
    return "PUPPET_SERVER_URL is not set";
  case CONFIG_ERROR_INVALID_SERVER_URL:
    return "PUPPET_SERVER_URL must start with http:// or https://";
  case CONFIG_ERROR_SERVER_URL_TOO_LONG:
    return "PUPPET_SERVER_URL is too long";
  case CONFIG_ERROR_ORGANIZATION_ID_TOO_LONG:
    return "PUPPET_ORGANIZATION_ID is too long";
  case CONFIG_ERROR_MISSING_DATA_DIRECTORY:
    return "set PUPPET_DATA_DIRECTORY (HOME is unknown)";
  case CONFIG_ERROR_DATA_DIRECTORY_TOO_LONG:
    return "the data directory path is too long";
  case CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER:
    return "set PUPPET_DEVICE_IDENTIFIER (/etc/machine-id is unavailable)";
  case CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG:
    return "the device identifier is too long";
  case CONFIG_RESULT_OK:
    break;
  }
  return "unknown configuration error";
}

int main(void) {
  /** Block termination signals before anything else (see lifecycle.h). */
  const Lifecycle lifecycle = LifecycleI.create();

  char puppetStartTime[LIFECYCLE_TIMESTAMP_CAPACITY];
  LifecycleI.formatUtcNow(puppetStartTime);

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

  MmkvI.initialize(config.dataDirectory);
  MMKVHandle_t storage = MmkvI.createDefault();
  if (storage == NULL) {
    fprintf(
      stderr, "[error] cannot open storage in %s\n", config.dataDirectory
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
    .puppetVersion   = PUPPET_VERSION,
    .puppetStartTime = puppetStartTime,
  };
  AgentI.run(&environment);

  HttpClientI.destroy(httpClient);
  HttpClientI.cleanup();
  MmkvI.shutdown();
  return PUPPET_EXIT_SUCCESS;
}
