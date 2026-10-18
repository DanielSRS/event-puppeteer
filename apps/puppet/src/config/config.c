#include "config.h"

#include <stdio.h>
#include <string.h>

/**
 * systemd's stable, per-installation identifier. Survives reboots and
 * Puppet reinstalls, which keeps a re-flashed Puppet from appearing as a new
 * Device.
 */
#define CONFIG_MACHINE_IDENTIFIER_PATH "/etc/machine-id"

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

static ConfigResultCode configResolveDeviceIdentifier(
  const ConfigSources *sources, PuppetConfig *config
) {
  const char *identifier = sources->machineIdentifier;
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
    .serverUrl         = PUPPET_SERVER_URL,
    .machineIdentifier = storage->machineIdentifier,
  };
}

const struct ConfigType ConfigI = {
  .readSources = configReadSources,
  .resolve     = configResolve,
};
