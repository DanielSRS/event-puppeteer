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

/** Starts the `su` command: the shell assigns `SUDO_USER` for the Puppet. */
#define INSTALLATION_SUDO_USER_ASSIGNMENT INSTALLATION_SUDO_USER_VARIABLE "="

/** Separates the words of the `su` command. */
#define INSTALLATION_SHELL_WORD_SEPARATOR ' '

#define INSTALLATION_SHELL_QUOTE '\''

/** Closes the quote, adds an escaped quote and reopens: `'` inside `'...'`. */
static const char INSTALLATION_SHELL_ESCAPED_QUOTE[] = "'\\''";

static InstallationEnvironment installationReadEnvironment(void) {
  return (InstallationEnvironment){
    .invocationIdentifier = getenv(INSTALLATION_INVOCATION_VARIABLE),
    .sudoUser             = getenv(INSTALLATION_SUDO_USER_VARIABLE),
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

static InstallationResultCode installationReadBinaryDescription(
  const char *text, InstallationBinaryDescription *description
) {
  const char *digest = strstr(text, AUDIT_TRAIL_DIGEST_PREFIX);
  if (digest == NULL) {
    return INSTALLATION_ERROR_DESCRIPTION_WITHOUT_DIGEST;
  }
  /** The version and the digest are separated by one space. */
  const bool hasVersion = digest > text + 1;
  *description = (InstallationBinaryDescription){
    .hasVersion    = hasVersion,
    .version       = text,
    .versionLength = hasVersion ? (size_t)(digest - text) - 1 : 0,
    .digest        = digest,
  };
  return INSTALLATION_RESULT_OK;
}

/** Append a separator and `word` single-quoted; false when it does not fit. */
static bool installationAppendWord(
  char *buffer, const size_t capacity, size_t *length, const char *word
) {
  if (*length + 1 >= capacity) {
    return false;
  }
  buffer[(*length)++] = INSTALLATION_SHELL_WORD_SEPARATOR;
  return installationAppendQuoted(buffer, capacity, length, word);
}

static InstallationResultCode installationFormatSuCommand(
  char              *buffer,
  const size_t       capacity,
  const char        *userName,
  const char *const *arguments,
  const size_t       argumentCount
) {
  const size_t prefixLength = sizeof(INSTALLATION_SUDO_USER_ASSIGNMENT) - 1;
  if (prefixLength >= capacity) {
    return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
  }
  memcpy(buffer, INSTALLATION_SUDO_USER_ASSIGNMENT, prefixLength);
  size_t length = prefixLength;
  if (!installationAppendQuoted(buffer, capacity, &length, userName)) {
    return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
  }
  for (size_t index = 0; index < argumentCount; index++) {
    if (!installationAppendWord(buffer, capacity, &length, arguments[index])) {
      return INSTALLATION_ERROR_SU_COMMAND_TOO_LONG;
    }
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
  .readBinaryDescription = installationReadBinaryDescription,
  .formatSuCommand       = installationFormatSuCommand,
};
