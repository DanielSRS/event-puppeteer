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

/** Groups that Debian (`sudo`) and Fedora (`wheel`) allow to use `sudo`. */
static const char *const INSTALLATION_SUDO_GROUPS[] = {"sudo", "wheel"};

#define INSTALLATION_SUDO_GROUP_COUNT \
  (sizeof(INSTALLATION_SUDO_GROUPS) / sizeof(INSTALLATION_SUDO_GROUPS[0]))

#define INSTALLATION_SU_ENVIRONMENT_NAME "SUDO_USER="
#define INSTALLATION_SHELL_QUOTE         '\''

/** Closes the quote, adds an escaped quote and reopens: `'` inside `'...'`. */
static const char INSTALLATION_SHELL_ESCAPED_QUOTE[] = "'\\''";

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

static InstallationRepairs installationDiagnose(const InstallationFacts *facts) {
  return (InstallationRepairs){
    .binary     = !facts->binaryValid,
    .unit       = !facts->unitMatches,
    .enablement = facts->unitMatches && !facts->serviceEnabled,
  };
}

static bool installationNeedsRepair(const InstallationRepairs *repairs) {
  return repairs->binary || repairs->unit || repairs->enablement;
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

static bool installationIsExpectedUnit(const char *content, const size_t length) {
  return length == sizeof(INSTALLATION_UNIT_TEMPLATE) - 1
      && memcmp(content, INSTALLATION_UNIT_TEMPLATE, length) == 0;
}

static InstallationElevation installationChooseElevation(
  const char *const *groupNames, const size_t groupCount
) {
  for (size_t index = 0; index < groupCount; index++) {
    for (size_t sudoIndex = 0; sudoIndex < INSTALLATION_SUDO_GROUP_COUNT; sudoIndex++) {
      if (strcmp(groupNames[index], INSTALLATION_SUDO_GROUPS[sudoIndex]) == 0) {
        return INSTALLATION_ELEVATION_SUDO;
      }
    }
  }
  return INSTALLATION_ELEVATION_SU;
}

/** Append `text` single-quoted; false when it does not fit. */
static bool installationAppendQuoted(
  char *buffer, const size_t capacity, size_t *length, const char *text
) {
  const size_t escapedLength = sizeof(INSTALLATION_SHELL_ESCAPED_QUOTE) - 1;
  size_t       position      = *length;
  if (position + 1 >= capacity) {
    return false;
  }
  buffer[position++] = INSTALLATION_SHELL_QUOTE;
  for (const char *character = text; *character != '\0'; character++) {
    const size_t needed = *character == INSTALLATION_SHELL_QUOTE ? escapedLength : 1;
    if (position + needed + 1 >= capacity) {
      return false;
    }
    if (*character == INSTALLATION_SHELL_QUOTE) {
      memcpy(buffer + position, INSTALLATION_SHELL_ESCAPED_QUOTE, escapedLength);
    } else {
      buffer[position] = *character;
    }
    position += needed;
  }
  buffer[position++] = INSTALLATION_SHELL_QUOTE;
  *length            = position;
  return true;
}

static InstallationResultCode installationFormatSuCommand(
  char       *buffer,
  const size_t capacity,
  const char *executablePath,
  const char *userName
) {
  const size_t prefixLength = sizeof(INSTALLATION_SU_ENVIRONMENT_NAME) - 1;
  if (prefixLength + 1 >= capacity) {
    return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
  }
  memcpy(buffer, INSTALLATION_SU_ENVIRONMENT_NAME, prefixLength);
  size_t length = prefixLength;
  if (!installationAppendQuoted(buffer, capacity, &length, userName)
      || length + 2 >= capacity) {
    return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
  }
  buffer[length++] = ' ';
  if (!installationAppendQuoted(buffer, capacity, &length, executablePath)) {
    return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
  }
  buffer[length] = '\0';
  return INSTALLATION_RESULT_OK;
}

const struct InstallationType InstallationI = {
  .readEnvironment = installationReadEnvironment,
  .decideRole      = installationDecideRole,
  .diagnose        = installationDiagnose,
  .needsRepair     = installationNeedsRepair,
  .isExpectedUnit  = installationIsExpectedUnit,
  .formatUnit      = installationFormatUnit,
  .chooseElevation = installationChooseElevation,
  .formatSuCommand = installationFormatSuCommand,
};
