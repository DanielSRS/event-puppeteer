#include "installation.h"

#include <stdlib.h>
#include <string.h>

/**
 * Seconds systemd waits before restarting the agent. Keeps a crash loop
 * below systemd's start rate limit, which would stop restarting it for good.
 */
#define INSTALLATION_RESTART_DELAY_SECONDS "5"

static const char INSTALLATION_UNIT_TEMPLATE[] =
  "[Unit]\n"
  "Description=DSRS Puppet\n"
  "After=network-online.target\n"
  "Wants=network-online.target\n"
  "\n"
  "[Service]\n"
  "Type=simple\n"
  "User=root\n"
  "ExecStart=" CONFIG_BINARY_PATH "\n"
  "Restart=always\n"
  "RestartSec=" INSTALLATION_RESTART_DELAY_SECONDS "\n"
  "\n"
  "[Install]\n"
  "WantedBy=multi-user.target\n";

static InstallationEnvironment installationReadEnvironment(void) {
  return (InstallationEnvironment){
    .invocationIdentifier = getenv("INVOCATION_ID"),
    .sudoUser             = getenv("SUDO_USER"),
  };
}

static InstallationRole installationDecideRole(const InstallationInputs *inputs) {
  const bool startedBySystemd = inputs->invocationIdentifier != NULL
                             && inputs->invocationIdentifier[0] != '\0';
  const bool fromInstalledBinary = inputs->executablePath != NULL
                                && strcmp(inputs->executablePath, CONFIG_BINARY_PATH) == 0;
  return startedBySystemd && fromInstalledBinary ? INSTALLATION_ROLE_AGENT
                                                 : INSTALLATION_ROLE_TERMINAL;
}

static InstallationState installationClassify(
  const bool binaryPresent, const bool unitPresent
) {
  if (binaryPresent && unitPresent) {
    return INSTALLATION_STATE_PRESENT;
  }
  return binaryPresent || unitPresent ? INSTALLATION_STATE_PARTIAL
                                      : INSTALLATION_STATE_ABSENT;
}

static InstallationResultCode installationFormatUnit(
  char *buffer, const size_t capacity
) {
  const size_t length = sizeof(INSTALLATION_UNIT_TEMPLATE) - 1;
  if (length >= capacity) {
    return INSTALLATION_ERROR_UNIT_BUFFER_TOO_SMALL;
  }
  memcpy(buffer, INSTALLATION_UNIT_TEMPLATE, length + 1);
  return INSTALLATION_RESULT_OK;
}

const struct InstallationType InstallationI = {
  .readEnvironment = installationReadEnvironment,
  .decideRole      = installationDecideRole,
  .classify        = installationClassify,
  .formatUnit      = installationFormatUnit,
};
