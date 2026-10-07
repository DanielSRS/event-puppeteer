#include "config.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * systemd's stable, per-installation identifier. Survives reboots and
 * Puppet reinstalls, which keeps a re-flashed Puppet from appearing as a new
 * Device.
 */
#define CONFIG_MACHINE_IDENTIFIER_PATH "/etc/machine-id"

#define CONFIG_DATA_SUBDIRECTORY      "puppet"
#define CONFIG_HOME_DATA_SUBDIRECTORY ".local/share/puppet"

static bool configIsSet(const char *value) {
  return value != NULL && value[0] != '\0';
}

/** Copy `source` into `destination`, failing instead of truncating. */
static bool configCopy(
  char *destination, const size_t capacity, const char *source
) {
  const size_t length = strlen(source);
  if (length >= capacity) {
    return false;
  }
  memcpy(destination, source, length + 1);
  return true;
}

static bool configStartsWith(const char *text, const char *prefix) {
  return strncmp(text, prefix, strlen(prefix)) == 0;
}

static ConfigResultCode configResolveServerUrl(
  const char *serverUrl, PuppetConfig *config
) {
  if (!configIsSet(serverUrl)) {
    return CONFIG_ERROR_MISSING_SERVER_URL;
  }
  if (!configStartsWith(serverUrl, "http://")
      && !configStartsWith(serverUrl, "https://")) {
    return CONFIG_ERROR_INVALID_SERVER_URL;
  }
  if (!configCopy(config->serverUrl, sizeof(config->serverUrl), serverUrl)) {
    return CONFIG_ERROR_SERVER_URL_TOO_LONG;
  }

  /** Request paths start with '/', so a trailing one would double it. */
  size_t length = strlen(config->serverUrl);
  while (length > 0 && config->serverUrl[length - 1] == '/') {
    length--;
    config->serverUrl[length] = '\0';
  }
  return CONFIG_RESULT_OK;
}

static ConfigResultCode configResolveDataDirectory(
  const ConfigSources *sources, PuppetConfig *config
) {
  const size_t capacity = sizeof(config->dataDirectory);
  int32_t      written  = 0;
  if (configIsSet(sources->dataDirectory)) {
    written = snprintf(config->dataDirectory, capacity, "%s", sources->dataDirectory);
  } else if (configIsSet(sources->dataHome)) {
    written = snprintf(
      config->dataDirectory,
      capacity,
      "%s/" CONFIG_DATA_SUBDIRECTORY,
      sources->dataHome
    );
  } else if (configIsSet(sources->home)) {
    written = snprintf(
      config->dataDirectory,
      capacity,
      "%s/" CONFIG_HOME_DATA_SUBDIRECTORY,
      sources->home
    );
  } else {
    return CONFIG_ERROR_MISSING_DATA_DIRECTORY;
  }
  if (written < 0 || (size_t)written >= capacity) {
    return CONFIG_ERROR_DATA_DIRECTORY_TOO_LONG;
  }
  return CONFIG_RESULT_OK;
}

static ConfigResultCode configResolveDeviceIdentifier(
  const ConfigSources *sources, PuppetConfig *config
) {
  const char *identifier = configIsSet(sources->deviceIdentifier)
                           ? sources->deviceIdentifier
                           : sources->machineIdentifier;
  if (!configIsSet(identifier)) {
    return CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER;
  }
  if (!configCopy(
        config->deviceIdentifier, sizeof(config->deviceIdentifier), identifier
      )) {
    return CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG;
  }
  return CONFIG_RESULT_OK;
}

static ConfigResultCode configResolve(
  const ConfigSources *sources, PuppetConfig *config
) {
  const ConfigResultCode serverUrlCode =
    configResolveServerUrl(sources->serverUrl, config);
  if (serverUrlCode != CONFIG_RESULT_OK) {
    return serverUrlCode;
  }

  config->hasOrganization = configIsSet(sources->organizationId);
  config->organizationId[0] = '\0';
  if (config->hasOrganization
      && !configCopy(
        config->organizationId,
        sizeof(config->organizationId),
        sources->organizationId
      )) {
    return CONFIG_ERROR_ORGANIZATION_ID_TOO_LONG;
  }

  const ConfigResultCode dataDirectoryCode =
    configResolveDataDirectory(sources, config);
  if (dataDirectoryCode != CONFIG_RESULT_OK) {
    return dataDirectoryCode;
  }
  return configResolveDeviceIdentifier(sources, config);
}

/** Read the machine id into `destination`, or leave it empty. */
static void configReadMachineIdentifier(char *destination, const size_t capacity) {
  destination[0] = '\0';
  FILE *file = fopen(CONFIG_MACHINE_IDENTIFIER_PATH, "r");
  if (file == NULL) {
    return;
  }
  if (fgets(destination, (int32_t)capacity, file) == NULL) {
    destination[0] = '\0';
  }
  fclose(file);
  destination[strcspn(destination, " \t\r\n")] = '\0';
}

static ConfigSources configReadSources(ConfigSourceStorage *storage) {
  configReadMachineIdentifier(
    storage->machineIdentifier, sizeof(storage->machineIdentifier)
  );
  return (ConfigSources){
    .serverUrl         = getenv("PUPPET_SERVER_URL"),
    .organizationId    = getenv("PUPPET_ORGANIZATION_ID"),
    .dataDirectory     = getenv("PUPPET_DATA_DIRECTORY"),
    .deviceIdentifier  = getenv("PUPPET_DEVICE_IDENTIFIER"),
    .dataHome          = getenv("XDG_DATA_HOME"),
    .home              = getenv("HOME"),
    .machineIdentifier = storage->machineIdentifier,
  };
}

const struct ConfigType ConfigI = {
  .readSources = configReadSources,
  .resolve     = configResolve,
};
