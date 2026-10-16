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

#include "audit-trail/audit-trail.h"
#include "config/config.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** Room for the unit file's content. */
#define INSTALLATION_UNIT_CAPACITY ((size_t)1024)

/** Room for the command `su -c` hands to root's shell. */
#define INSTALLATION_SU_COMMAND_CAPACITY ((size_t)1024)

typedef enum {
  INSTALLATION_RESULT_OK = 0,

  /** A binary's description in the trail has no digest. */
  INSTALLATION_ERROR_DESCRIPTION_WITHOUT_DIGEST = 7003,
  /** A user id is empty, not a decimal number, or too large. */
  INSTALLATION_ERROR_USER_IDENTIFIER_INVALID = 7004,

  /** The unit does not fit the buffer. */
  INSTALLATION_ERROR_UNIT_BUFFER_TOO_SMALL = 7001,

  /** The command for `su` does not fit the buffer. */
  INSTALLATION_ERROR_SU_COMMAND_TOO_LONG = 7002,
} InstallationResultCode;

typedef enum {
  /** Started by systemd from the installed binary. */
  INSTALLATION_ROLE_AGENT = 1,
  /** Run by a person, from wherever the binary happens to be. */
  INSTALLATION_ROLE_TERMINAL,
} InstallationRole;

/**
 * How the Device Audit Trail describes the installed binary: the version,
 * when one is known, and the digest text (`sha256:<hex>`). Both point into
 * the description they were read from.
 */
typedef struct {
  bool        hasVersion;
  const char *version;
  size_t      versionLength;
  const char *digest;
} InstallationBinaryDescription;

/** What the system says about the three pieces of the Installation. */
typedef struct {
  /** The installed binary is an ELF for this architecture. */
  bool binaryValid;

  /** The unit exists with exactly the expected content. */
  bool unitMatches;

  /** `systemctl is-enabled` says the service is enabled. */
  bool serviceEnabled;
} InstallationFacts;

/** Which pieces to put right. Never stored: derived from the facts. */
typedef struct {
  bool binary;
  bool unit;
  bool enablement;
} InstallationRepairs;

/** What the process knows about how it was started. Strings are borrowed. */
typedef struct {
  /** systemd's `INVOCATION_ID`, or NULL when unset. */
  const char *invocationIdentifier;

  /** Absolute path of the running executable. */
  const char *executablePath;
} InstallationInputs;

/** Set by systemd for every process it starts. */
#define INSTALLATION_INVOCATION_VARIABLE "INVOCATION_ID"

/** Set by `sudo` (and by the `su` command below) to the technician's name. */
#define INSTALLATION_SUDO_USER_VARIABLE "SUDO_USER"

/** Set by `pkexec` to the user id of whoever called it. */
#define INSTALLATION_PKEXEC_UID_VARIABLE "PKEXEC_UID"

/** The environment variables the Installation reads. NULL when unset. */
typedef struct {
  /** `INVOCATION_ID`: set by systemd for every process it starts. */
  const char *invocationIdentifier;

  /** `SUDO_USER`: the user who ran `sudo`. */
  const char *sudoUser;

  /** `PKEXEC_UID`: the user id of whoever ran `pkexec`. */
  const char *pkexecUserIdentifier;
} InstallationEnvironment;

struct InstallationType {
  /** Read `INVOCATION_ID`, `SUDO_USER` and `PKEXEC_UID`. Never fails. */
  InstallationEnvironment (*const readEnvironment)(void);

  /**
   * The agent is only the process systemd started (`INVOCATION_ID` set and
   * non-empty) from the installed binary path. Anything else is a terminal.
   */
  InstallationRole (*const decideRole)(const InstallationInputs *inputs);

  /**
   * Which pieces diverge. Each is repaired on its own. Enablement is only
   * decided while the unit matches: without the right unit systemd cannot
   * tell whether the service is enabled, so it is checked again once the
   * unit has been repaired.
   */
  InstallationRepairs (*const diagnose)(const InstallationFacts *facts);

  /** Whether any piece needs repair, i.e. whether root is needed. */
  bool (*const needsRepair)(const InstallationRepairs *repairs);

  /** Whether `content` is exactly the unit `formatUnit` writes. */
  bool (*const isExpectedUnit)(const char *content, size_t length);

  /**
   * Write the content of the systemd unit: it waits for
   * `network-online.target`, runs as root and restarts on any exit.
   *
   * @param capacity  At least `INSTALLATION_UNIT_CAPACITY`.
   */
  InstallationResultCode (*const formatUnit)(char *buffer, size_t capacity);

  /**
   * Split the `after` of the latest "binary" entry of the trail, written as
   * "<version> sha256:<hex>" or, for an update without a version, as
   * "sha256:<hex>".
   *
   * @return `INSTALLATION_RESULT_OK`, or
   *         `INSTALLATION_ERROR_DESCRIPTION_WITHOUT_DIGEST`.
   */
  InstallationResultCode (*const readBinaryDescription)(
    const char *text, InstallationBinaryDescription *description
  );

  /**
   * Read a user id written in decimal, as `pkexec` writes `PKEXEC_UID`.
   * Anything else (empty, a sign, other characters, beyond 32 bits) is
   * rejected rather than read in part.
   *
   * @return `INSTALLATION_RESULT_OK`, or
   *         `INSTALLATION_ERROR_USER_IDENTIFIER_INVALID`.
   */
  InstallationResultCode (*const readUserIdentifier)(
    const char *text, uint32_t *identifier
  );

  /**
   * Write the shell command `su -c` runs as root: it sets `SUDO_USER` to
   * `userName`, so the Audit Trail names the technician as it does under
   * `sudo`, and runs the Puppet again with the same arguments. Every word is
   * single-quoted for the shell.
   *
   * @param capacity       At least `INSTALLATION_SU_COMMAND_CAPACITY`.
   * @param arguments      The process's arguments; the first is the path of
   *                       the executable.
   * @param argumentCount  At least one.
   */
  InstallationResultCode (*const formatSuCommand)(
    char              *buffer,
    size_t             capacity,
    const char        *userName,
    const char *const *arguments,
    size_t             argumentCount
  );
};

extern const struct InstallationType InstallationI;

#ifdef PUPPET_INSTALLATION_IMPLEMENTATION
#include "installation.c"
#endif

#endif // PUPPET_INSTALLATION_H_
