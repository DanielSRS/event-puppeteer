/**
 * @file installer.h
 * @brief The fresh Installation, end to end (ADR-0001).
 *
 * Run by a person as `./puppet`, with no arguments. Whether the Puppet is
 * installed is never stored: every run checks the three pieces against the
 * system.
 *
 * - the binary at `CONFIG_BINARY_PATH` is an ELF for this architecture (the
 *   check self-update applies to a download);
 * - the systemd unit exists with exactly the expected content;
 * - the service is enabled.
 *
 * When all three hold, `run` does not watch the agent: it prints a status
 * summary and changes nothing, needing no password. The summary reads the
 * Device Audit Trail: the installed version is the one last recorded for
 * the binary, checked against the installed binary's digest, and the
 * Enrollment state is the last one recorded. The service state and the
 * Device identifier come from the system. Otherwise it repairs each diverging
 * piece on its own:
 *
 * 1. re-runs the Puppet as root, with the same arguments, when it is not:
 *    through `sudo` when `sudo -v` accepts the user (their own password),
 *    otherwise through `su` (the root password), saying which on the
 *    terminal. It fails explicitly when neither can run it;
 * 2. creates the data and binary directories when missing;
 * 3. copies the running executable to `CONFIG_BINARY_PATH` when the binary
 *    is missing or invalid. A valid installed binary is never replaced, even
 *    when it differs from the running one: only self-update changes it, so
 *    an old copy cannot downgrade a Device;
 * 4. writes the unit when it is missing or differs, and reloads systemd;
 * 5. enables the service when it is not, and starts it when it is stopped;
 * 6. prints what it changed;
 * 7. watches the agent (see `watcher.h`): streams its journal until the
 *    Device is pending in Enrollment, or fails after 60 seconds with the
 *    agent's last error. The service keeps retrying on its own.
 *
 * Every change appends one entry to the Device Audit Trail, with the local
 * user from `SUDO_USER` as "who", plus before and after. Nothing that was
 * already right is recorded. A failure partway leaves the steps already
 * done in the trail and nothing else is attempted.
 *
 * Files are written to a sibling temporary path and renamed into place, so
 * a power cut never leaves a half-written binary or unit.
 *
 * This default implementation targets systemd-based Linux.
 */
#ifndef PUPPET_INSTALLER_H_
#define PUPPET_INSTALLER_H_

#include <stddef.h>

typedef enum {
  INSTALLER_RESULT_OK = 0,

  /** `sudo` is installed but could not be started to ask about this user. */
  INSTALLER_ERROR_SUDO_UNAVAILABLE = 8001,
  /** The file about to be replaced could not be opened to record it. */
  INSTALLER_ERROR_PREVIOUS_CONTENT_UNREADABLE = 8002,
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
  /** More arguments than can be handed on to the Puppet run as root. */
  INSTALLER_ERROR_TOO_MANY_ARGUMENTS = 8014,
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
  /** `su` could not be started. The wrong password is `su`'s own error. */
  INSTALLER_ERROR_SU_UNAVAILABLE = 8026,
  /** Waiting for `sudo -v` failed. */
  INSTALLER_ERROR_SUDO_WAIT_FAILED = 8027,
  /** The name of the user running the Puppet is unknown (needed for `su`). */
  INSTALLER_ERROR_USER_UNKNOWN = 8028,
  /** The arguments or the user name do not fit the command for `su`. */
  INSTALLER_ERROR_SU_COMMAND_TOO_LONG = 8029,
  /** The running executable's header could not be read. */
  INSTALLER_ERROR_RUNNING_HEADER_UNREADABLE = 8030,
  /** The Device identifier could not be determined. */
  INSTALLER_ERROR_DEVICE_IDENTIFIER_UNKNOWN = 8032,
  /** The Audit Trail exists but could not be read. */
  INSTALLER_ERROR_ENROLLMENT_UNREADABLE = 8033,
  /** The file about to be replaced could not be read to record it. */
  INSTALLER_ERROR_PREVIOUS_CONTENT_READ_FAILED = 8034,
  /** The digest of the file about to be replaced does not fit its text. */
  INSTALLER_ERROR_PREVIOUS_CONTENT_TEXT_TOO_LONG = 8035,
  /** The agent did not report the Device as pending in time. */
  INSTALLER_ERROR_WATCH_TIMED_OUT = 8038,
  /** Watching the agent failed (the watcher's code is printed). */
  INSTALLER_ERROR_WATCH_FAILED = 8039,
  /** `sudo` accepted the user but could not replace this process. */
  INSTALLER_ERROR_SUDO_EXEC_FAILED = 8040,
  /** The trail exists but its binary entries could not be read. */
  INSTALLER_ERROR_BINARY_RECORD_UNREADABLE = 8041,
  /** The binary's latest entry in the trail has no digest. */
  INSTALLER_ERROR_BINARY_RECORD_WITHOUT_DIGEST = 8042,
  /** The installed version's description does not fit its text. */
  INSTALLER_ERROR_VERSION_TEXT_TOO_LONG = 8043,
} InstallerResultCode;

/** Everything the Installation needs from the outside. Borrowed. */
typedef struct {
  /** Absolute path of the running executable: what gets installed. */
  const char *executablePath;

  /**
   * The process's arguments, the program name first, handed on unchanged
   * to the Puppet run as root.
   */
  char *const *arguments;
  size_t       argumentCount;

  /** `SUDO_USER` (also set by the `su` command), or NULL when unset. */
  const char *sudoUser;

  /** Version of this build, recorded with the binary. */
  const char *puppetVersion;
} InstallerContext;

struct InstallerType {
  /**
   * Repair the Installation, or report its status when nothing diverges.
   *
   * Messages go to the terminal: what was changed on success, the reason on
   * failure. When not root this does not return on success: the process
   * is replaced by `sudo` or `su`, which runs the Puppet again as root.
   *
   * @return `INSTALLER_RESULT_OK` when the Installation is intact (repaired
   *         now or before), otherwise the code of the step that failed.
   */
  InstallerResultCode (*const run)(const InstallerContext *context);
};

extern const struct InstallerType InstallerI;

#ifdef PUPPET_INSTALLER_IMPLEMENTATION
#include "installer.c"
#endif

#endif // PUPPET_INSTALLER_H_
