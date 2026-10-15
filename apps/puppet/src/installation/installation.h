/**
 * @file installation.h
 * @brief The pure rules of the Installation (ADR-0001): which role this
 *        process plays, what is installed, and what the unit contains.
 *
 * The Puppet is one binary that plays one of two roles:
 *
 * - **agent**: the process systemd starts from the installed binary;
 * - **terminal**: any other run, which installs (see `installer.h`) and
 *   never becomes the agent.
 *
 * Everything here is pure and unit-tested, except `readEnvironment`, the
 * only place the Puppet reads environment variables: the two that systemd
 * and sudo set to say who started the process. They are never used as
 * configuration.
 */
#ifndef PUPPET_INSTALLATION_H_
#define PUPPET_INSTALLATION_H_

#include "config/config.h"

#include <stdbool.h>
#include <stddef.h>

/** Room for the unit file's content. */
#define INSTALLATION_UNIT_CAPACITY ((size_t)1024)

typedef enum {
  INSTALLATION_RESULT_OK = 0,

  /** The unit does not fit the buffer. */
  INSTALLATION_ERROR_UNIT_BUFFER_TOO_SMALL = 7001,
} InstallationResultCode;

typedef enum {
  /** Started by systemd from the installed binary. */
  INSTALLATION_ROLE_AGENT = 1,
  /** Run by a person, from wherever the binary happens to be. */
  INSTALLATION_ROLE_TERMINAL,
} InstallationRole;

typedef enum {
  /** Neither the binary nor the unit exists. */
  INSTALLATION_STATE_ABSENT = 1,
  /** Both the binary and the unit exist. */
  INSTALLATION_STATE_PRESENT,
  /** Only one of them exists: a diverging Installation. */
  INSTALLATION_STATE_PARTIAL,
} InstallationState;

/** What the process knows about how it was started. Strings are borrowed. */
typedef struct {
  /** systemd's `INVOCATION_ID`, or NULL when unset. */
  const char *invocationIdentifier;

  /** Absolute path of the running executable. */
  const char *executablePath;
} InstallationInputs;

/** The environment variables the Installation reads. NULL when unset. */
typedef struct {
  /** `INVOCATION_ID`: set by systemd for every process it starts. */
  const char *invocationIdentifier;

  /** `SUDO_USER`: the user who ran `sudo`. */
  const char *sudoUser;
} InstallationEnvironment;

struct InstallationType {
  /** Read `INVOCATION_ID` and `SUDO_USER`. Never fails. */
  InstallationEnvironment (*const readEnvironment)(void);

  /**
   * The agent is only the process systemd started (`INVOCATION_ID` set and
   * non-empty) from the installed binary path. Anything else is a terminal.
   */
  InstallationRole (*const decideRole)(const InstallationInputs *inputs);

  /** What `binaryPresent` and `unitPresent` say about the Installation. */
  InstallationState (*const classify)(bool binaryPresent, bool unitPresent);

  /**
   * Write the content of the systemd unit: it waits for
   * `network-online.target`, runs as root and restarts on any exit.
   *
   * @param capacity  At least `INSTALLATION_UNIT_CAPACITY`.
   */
  InstallationResultCode (*const formatUnit)(char *buffer, size_t capacity);
};

extern const struct InstallationType InstallationI;

#ifdef PUPPET_INSTALLATION_IMPLEMENTATION
#include "installation.c"
#endif

#endif // PUPPET_INSTALLATION_H_
