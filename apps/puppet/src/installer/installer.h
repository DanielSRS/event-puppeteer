/**
 * @file installer.h
 * @brief The fresh Installation, end to end (ADR-0001).
 *
 * Run by a person as `./puppet`, with no arguments. On a Device with nothing
 * installed, `run`:
 *
 * 1. re-runs the Puppet through `sudo` when not root (the technician types
 *    the password), failing explicitly when `sudo` is missing or denied;
 * 2. creates the data directory;
 * 3. copies the running executable to `CONFIG_BINARY_PATH`;
 * 4. writes the systemd unit (see `installation.h`);
 * 5. reloads systemd, then enables and starts the service;
 * 6. prints what it changed.
 *
 * Every change appends one entry to the Device Audit Trail, with the local
 * user from `SUDO_USER` as "who", before (absent) and after. A failure
 * partway leaves the steps already done in the trail and nothing else is
 * attempted. Repairing the remaining pieces is a separate feature: a
 * diverging Installation is refused, and an Installation that is already
 * complete is left alone.
 *
 * Files are written to a sibling temporary path and renamed into place, so
 * a power cut never leaves a half-written binary or unit.
 *
 * This default implementation targets systemd-based Linux.
 */
#ifndef PUPPET_INSTALLER_H_
#define PUPPET_INSTALLER_H_

typedef enum {
  INSTALLER_RESULT_OK = 0,

  /** `sudo` could not be started. The wrong password is `sudo`'s own error. */
  INSTALLER_ERROR_SUDO_UNAVAILABLE = 8001,
  /** Only the binary or only the unit exists. */
  INSTALLER_ERROR_PARTIAL_INSTALLATION = 8002,
  /** The data directory could not be created. */
  INSTALLER_ERROR_DATA_DIRECTORY_FAILED = 8003,
  /** The binary's directory could not be created. */
  INSTALLER_ERROR_BINARY_DIRECTORY_FAILED = 8004,
  /** The running executable could not be read. */
  INSTALLER_ERROR_BINARY_SOURCE_UNREADABLE = 8005,
  /** The copy of the binary could not be written. */
  INSTALLER_ERROR_BINARY_WRITE_FAILED = 8006,
  /** The copy could not be moved to the binary path. */
  INSTALLER_ERROR_BINARY_REPLACE_FAILED = 8007,
  /** The unit's content could not be produced. */
  INSTALLER_ERROR_UNIT_FORMAT_FAILED = 8008,
  /** The unit could not be written. */
  INSTALLER_ERROR_UNIT_WRITE_FAILED = 8009,
  /** `systemctl daemon-reload` failed. */
  INSTALLER_ERROR_RELOAD_FAILED = 8010,
  /** `systemctl enable` failed. */
  INSTALLER_ERROR_ENABLE_FAILED = 8011,
  /** `systemctl start` failed. */
  INSTALLER_ERROR_START_FAILED = 8012,
  /** The service started but is not active. */
  INSTALLER_ERROR_NOT_ACTIVE = 8013,
  /** The executable path does not fit the argument handed to `sudo`. */
  INSTALLER_ERROR_SUDO_PATH_TOO_LONG = 8014,
  /** The binary's temporary path does not fit its buffer. */
  INSTALLER_ERROR_BINARY_TEMPORARY_PATH_TOO_LONG = 8015,
  /** The binary's temporary file could not be created. */
  INSTALLER_ERROR_BINARY_CREATE_FAILED = 8016,
  /** The binary's description for the Audit Trail does not fit. */
  INSTALLER_ERROR_BINARY_DESCRIPTION_TOO_LONG = 8017,
  /** The unit's temporary path does not fit its buffer. */
  INSTALLER_ERROR_UNIT_TEMPORARY_PATH_TOO_LONG = 8018,
  /** The unit's description for the Audit Trail does not fit. */
  INSTALLER_ERROR_UNIT_DESCRIPTION_TOO_LONG = 8019,
  /** The data directory's Audit Trail entry could not be written. */
  INSTALLER_ERROR_DATA_DIRECTORY_AUDIT_FAILED = 8020,
  /** The binary directory's Audit Trail entry could not be written. */
  INSTALLER_ERROR_BINARY_DIRECTORY_AUDIT_FAILED = 8021,
  /** The binary's Audit Trail entry could not be written. */
  INSTALLER_ERROR_BINARY_AUDIT_FAILED = 8022,
  /** The unit's Audit Trail entry could not be written. */
  INSTALLER_ERROR_UNIT_AUDIT_FAILED = 8023,
  /** The enablement's Audit Trail entry could not be written. */
  INSTALLER_ERROR_ENABLE_AUDIT_FAILED = 8024,
  /** The service state's Audit Trail entry could not be written. */
  INSTALLER_ERROR_STATE_AUDIT_FAILED = 8025,
} InstallerResultCode;

/** Everything the Installation needs from the outside. Borrowed. */
typedef struct {
  /** Absolute path of the running executable: what gets installed. */
  const char *executablePath;

  /** `SUDO_USER`, or NULL when the Puppet was not started through sudo. */
  const char *sudoUser;

  /** Version of this build, recorded with the binary. */
  const char *puppetVersion;
} InstallerContext;

struct InstallerType {
  /**
   * Install the Puppet, or report that it already is.
   *
   * Messages go to the terminal: what was changed on success, the reason on
   * failure. When not root this does not return on success: the process
   * is replaced by `sudo`, which runs the Puppet again as root.
   *
   * @return `INSTALLER_RESULT_OK` when the Installation is complete (done
   *         now or before), otherwise the code of the step that failed.
   */
  InstallerResultCode (*const run)(const InstallerContext *context);
};

extern const struct InstallerType InstallerI;

#ifdef PUPPET_INSTALLER_IMPLEMENTATION
#include "installer.c"
#endif

#endif // PUPPET_INSTALLER_H_
