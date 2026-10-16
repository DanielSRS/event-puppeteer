#include "installer.h"

#include "audit-trail/audit-trail.h"
#include "config/config.h"
#include "crypto/sha256.h"
#include "installation/installation.h"
#include "lifecycle/lifecycle.h"
#include "update/self-update.h"

#include <errno.h>
#include <grp.h>
#include <fcntl.h>
#include <pwd.h>
#include <spawn.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

/** The process environment, required by posix_spawnp for the child. */
extern char **environ;

#define INSTALLER_SUDO_PROGRAM       "sudo"
#define INSTALLER_SU_PROGRAM         "su"
#define INSTALLER_SU_COMMAND_OPTION  "-c"
#define INSTALLER_GROUP_CAPACITY     ((size_t)64)
#define INSTALLER_GROUP_NAME_CAPACITY ((size_t)64)
#define INSTALLER_SYSTEMCTL_PROGRAM  "systemctl"
#define INSTALLER_TEMPORARY_SUFFIX   ".installing"
#define INSTALLER_PATH_CAPACITY      ((size_t)512)
#define INSTALLER_TEXT_CAPACITY      ((size_t)192)
#define INSTALLER_COPY_CHUNK_LENGTH  ((size_t)16384)
#define INSTALLER_VERSION_CAPACITY   ((size_t)64)
#define INSTALLER_ENROLLMENT_CAPACITY ((size_t)256)

/** `Audit Trail` text for a file that is not there. */
#define INSTALLER_ABSENT_TEXT "absent"

/** Whoever runs the Puppet as root without sudo is, truthfully, root. */
#define INSTALLER_ROOT_USER "root"

/** Directories are traversable by everyone; only root writes them. */
#define INSTALLER_DIRECTORY_MODE ((mode_t)0755)
#define INSTALLER_EXECUTABLE_MODE ((mode_t)0755)
#define INSTALLER_UNIT_MODE       ((mode_t)0644)

typedef struct {
  const InstallerContext *context;
  AuditTrailActor         actor;
} InstallerRun;

/** Append one change to the Device Audit Trail, or stop the Installation. */
static InstallerResultCode installerRecord(
  const InstallerRun *run,
  const char         *what,
  const char         *before,
  const char         *after,
  const InstallerResultCode failureCode
) {
  char when[LIFECYCLE_TIMESTAMP_CAPACITY];
  LifecycleI.formatUtcNow(when);
  const AuditTrailEntry entry = {
    .when = when, .actor = run->actor, .what = what, .before = before, .after = after
  };
  const AuditTrailResultCode code =
    AuditTrailI.append(CONFIG_AUDIT_TRAIL_PATH, &entry);
  if (code != AUDIT_TRAIL_RESULT_OK) {
    fprintf(
      stderr,
      "[error] cannot record \"%s\" in %s (%d)\n",
      what,
      CONFIG_AUDIT_TRAIL_PATH,
      code
    );
    return failureCode;
  }
  return INSTALLER_RESULT_OK;
}

static bool installerFits(const int32_t written, const size_t capacity) {
  return written >= 0 && (size_t)written < capacity;
}

/** `sudo <this executable>`: replaces the process, so only failure returns. */
static InstallerResultCode installerElevateWithSudo(const char *executablePath) {
  char sudo[]  = INSTALLER_SUDO_PROGRAM;
  char path[INSTALLER_PATH_CAPACITY];
  if (!installerFits(
        snprintf(path, sizeof(path), "%s", executablePath), sizeof(path)
      )) {
    fprintf(stderr, "[error] the executable path is too long to hand to sudo\n");
    return INSTALLER_ERROR_SUDO_PATH_TOO_LONG;
  }
  char *const arguments[] = {sudo, path, NULL};
  execvp(INSTALLER_SUDO_PROGRAM, arguments);
  fprintf(
    stderr,
    "[error] installing needs root, and sudo could not be started: %s\n",
    strerror(errno)
  );
  return INSTALLER_ERROR_SUDO_UNAVAILABLE;
}

/**
 * `su -c <command> root`: replaces the process, so only failure returns. The
 * command sets `SUDO_USER` so the Audit Trail names the technician.
 */
static InstallerResultCode installerElevateWithSu(
  const char *executablePath, const char *userName
) {
  char command[INSTALLATION_SU_COMMAND_CAPACITY];
  if (InstallationI.formatSuCommand(command, sizeof(command), executablePath, userName)
      != INSTALLATION_RESULT_OK) {
    fprintf(stderr, "[error] the executable path or user name is too long to hand to su\n");
    return INSTALLER_ERROR_SU_COMMAND_TOO_LONG;
  }
  char  su[]     = INSTALLER_SU_PROGRAM;
  char  option[] = INSTALLER_SU_COMMAND_OPTION;
  char  root[]   = INSTALLER_ROOT_USER;
  char *const arguments[] = {su, option, command, root, NULL};
  execvp(INSTALLER_SU_PROGRAM, arguments);
  fprintf(
    stderr,
    "[error] installing needs root, and su could not be started: %s\n",
    strerror(errno)
  );
  return INSTALLER_ERROR_SU_UNAVAILABLE;
}

/** Names of the groups the process belongs to, copied out of getgrgid's buffer. */
static InstallerResultCode installerReadGroupNames(
  char        names[][INSTALLER_GROUP_NAME_CAPACITY],
  size_t     *count
) {
  gid_t       groupIdentifiers[INSTALLER_GROUP_CAPACITY];
  const int32_t groupTotal = getgroups((int)INSTALLER_GROUP_CAPACITY, groupIdentifiers);
  if (groupTotal < 0) {
    fprintf(stderr, "[error] cannot read the user's groups: %s\n", strerror(errno));
    return INSTALLER_ERROR_GROUPS_UNREADABLE;
  }
  size_t found = 0;
  for (int32_t index = 0; index < groupTotal; index++) {
    const struct group *entry = getgrgid(groupIdentifiers[index]);
    if (entry == NULL
        || !installerFits(
             snprintf(names[found], INSTALLER_GROUP_NAME_CAPACITY, "%s", entry->gr_name),
             INSTALLER_GROUP_NAME_CAPACITY
           )) {
      continue;
    }
    found++;
  }
  *count = found;
  return INSTALLER_RESULT_OK;
}

/** Become root the way this user can: `sudo` in an administrative group, else `su`. */
static InstallerResultCode installerElevate(const char *executablePath) {
  char   groupNames[INSTALLER_GROUP_CAPACITY][INSTALLER_GROUP_NAME_CAPACITY];
  const char *groupPointers[INSTALLER_GROUP_CAPACITY];
  size_t groupCount = 0;
  const InstallerResultCode groupsCode = installerReadGroupNames(groupNames, &groupCount);
  if (groupsCode != INSTALLER_RESULT_OK) {
    return groupsCode;
  }
  for (size_t index = 0; index < groupCount; index++) {
    groupPointers[index] = groupNames[index];
  }

  if (InstallationI.chooseElevation(groupPointers, groupCount)
      == INSTALLATION_ELEVATION_SUDO) {
    printf("installing needs root: using sudo (type your password)\n");
    fflush(stdout);
    return installerElevateWithSudo(executablePath);
  }

  const struct passwd *user = getpwuid(getuid());
  if (user == NULL) {
    fprintf(stderr, "[error] cannot find the name of the user running the Puppet\n");
    return INSTALLER_ERROR_USER_UNKNOWN;
  }
  printf("installing needs root: you are not in the sudo or wheel group, using su (type the root password)\n");
  fflush(stdout);
  return installerElevateWithSu(executablePath, user->pw_name);
}

static bool installerRunSystemctl(const char *verb, const char *argument) {
  char  systemctl[] = INSTALLER_SYSTEMCTL_PROGRAM;
  char  verbCopy[INSTALLER_TEXT_CAPACITY];
  char  argumentCopy[INSTALLER_TEXT_CAPACITY];
  char *arguments[] = {systemctl, verbCopy, argumentCopy, NULL};
  if (!installerFits(snprintf(verbCopy, sizeof(verbCopy), "%s", verb), sizeof(verbCopy))) {
    return false;
  }
  if (argument == NULL) {
    arguments[2] = NULL;
  } else if (!installerFits(
               snprintf(argumentCopy, sizeof(argumentCopy), "%s", argument),
               sizeof(argumentCopy)
             )) {
    return false;
  }

  pid_t         child  = 0;
  const int32_t status = posix_spawnp(&child, systemctl, NULL, NULL, arguments, environ);
  if (status != 0) {
    return false;
  }
  int32_t exitStatus = 0;
  if (waitpid(child, &exitStatus, 0) != child) {
    return false;
  }
  return WIFEXITED(exitStatus) && WEXITSTATUS(exitStatus) == 0;
}

/** Create `path`; false only when it could not be created or found. */
static bool installerMakeDirectory(const char *path, bool *created) {
  if (mkdir(path, INSTALLER_DIRECTORY_MODE) == 0) {
    *created = true;
    return true;
  }
  *created = false;
  return errno == EEXIST;
}

static bool installerWriteAll(
  const int32_t descriptor, const uint8_t *data, const size_t length
) {
  size_t written = 0;
  while (written < length) {
    const ssize_t count = write(descriptor, data + written, length - written);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      return false;
    }
    written += (size_t)count;
  }
  return true;
}

/** `<path>.installing`, the sibling a file is written to before the rename. */
static bool installerTemporaryPath(const char *path, char *temporaryPath) {
  return installerFits(
    snprintf(
      temporaryPath,
      INSTALLER_PATH_CAPACITY,
      "%s" INSTALLER_TEMPORARY_SUFFIX,
      path
    ),
    INSTALLER_PATH_CAPACITY
  );
}

/**
 * Copy `sourcePath` to `temporaryPath`, hashing what is written. The copy is
 * flushed to disk and made executable before anyone can rename it into place.
 */
static InstallerResultCode installerCopyExecutable(
  const char *sourcePath, const char *temporaryPath, uint8_t *digest
) {
  const int32_t source = open(sourcePath, O_RDONLY | O_CLOEXEC);
  if (source < 0) {
    fprintf(stderr, "[error] cannot read %s: %s\n", sourcePath, strerror(errno));
    return INSTALLER_ERROR_BINARY_SOURCE_UNREADABLE;
  }
  unlink(temporaryPath);
  const int32_t destination = open(
    temporaryPath, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, INSTALLER_EXECUTABLE_MODE
  );
  if (destination < 0) {
    fprintf(stderr, "[error] cannot create %s: %s\n", temporaryPath, strerror(errno));
    close(source);
    return INSTALLER_ERROR_BINARY_CREATE_FAILED;
  }

  Sha256Context hash = Sha256I.create();
  uint8_t       chunk[INSTALLER_COPY_CHUNK_LENGTH];
  bool          copied = true;
  for (;;) {
    const ssize_t count = read(source, chunk, sizeof(chunk));
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      copied = false;
      break;
    }
    if (count == 0) {
      break;
    }
    Sha256I.update(&hash, chunk, (size_t)count);
    if (!installerWriteAll(destination, chunk, (size_t)count)) {
      copied = false;
      break;
    }
  }
  close(source);
  const bool flushed = copied && fchmod(destination, INSTALLER_EXECUTABLE_MODE) == 0
                    && fsync(destination) == 0;
  close(destination);
  if (!flushed) {
    fprintf(stderr, "[error] cannot write %s: %s\n", temporaryPath, strerror(errno));
    unlink(temporaryPath);
    return INSTALLER_ERROR_BINARY_WRITE_FAILED;
  }
  Sha256I.finish(&hash, digest);
  return INSTALLER_RESULT_OK;
}

static InstallerResultCode installerInstallBinary(
  const InstallerRun *run, const char *before
) {
  char temporaryPath[INSTALLER_PATH_CAPACITY];
  if (!installerTemporaryPath(CONFIG_BINARY_PATH, temporaryPath)) {
    return INSTALLER_ERROR_BINARY_TEMPORARY_PATH_TOO_LONG;
  }
  uint8_t                   digest[SHA256_DIGEST_LENGTH];
  const InstallerResultCode copied = installerCopyExecutable(
    run->context->executablePath, temporaryPath, digest
  );
  if (copied != INSTALLER_RESULT_OK) {
    return copied;
  }
  if (rename(temporaryPath, CONFIG_BINARY_PATH) != 0) {
    fprintf(stderr, "[error] cannot install %s: %s\n", CONFIG_BINARY_PATH, strerror(errno));
    unlink(temporaryPath);
    return INSTALLER_ERROR_BINARY_REPLACE_FAILED;
  }

  char hex[SHA256_HEX_DIGEST_CAPACITY];
  Sha256I.formatHexDigest(digest, hex);
  char after[INSTALLER_TEXT_CAPACITY];
  if (!installerFits(
        snprintf(
          after, sizeof(after), "%s sha256:%s", run->context->puppetVersion, hex
        ),
        sizeof(after)
      )) {
    return INSTALLER_ERROR_BINARY_DESCRIPTION_TOO_LONG;
  }
  printf("installed %s (%s)\n", CONFIG_BINARY_PATH, after);
  return installerRecord(run, "binary", before, after, INSTALLER_ERROR_BINARY_AUDIT_FAILED);
}

static InstallerResultCode installerInstallUnit(
  const InstallerRun *run, const char *before
) {
  char unit[INSTALLATION_UNIT_CAPACITY];
  if (InstallationI.formatUnit(unit, sizeof(unit)) != INSTALLATION_RESULT_OK) {
    return INSTALLER_ERROR_UNIT_FORMAT_FAILED;
  }
  char temporaryPath[INSTALLER_PATH_CAPACITY];
  if (!installerTemporaryPath(CONFIG_UNIT_PATH, temporaryPath)) {
    return INSTALLER_ERROR_UNIT_TEMPORARY_PATH_TOO_LONG;
  }

  const size_t  length = strlen(unit);
  unlink(temporaryPath);
  const int32_t descriptor = open(
    temporaryPath, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, INSTALLER_UNIT_MODE
  );
  const bool written =
    descriptor >= 0 && installerWriteAll(descriptor, (const uint8_t *)unit, length)
    && fchmod(descriptor, INSTALLER_UNIT_MODE) == 0 && fsync(descriptor) == 0;
  if (descriptor >= 0) {
    close(descriptor);
  }
  if (!written || rename(temporaryPath, CONFIG_UNIT_PATH) != 0) {
    fprintf(stderr, "[error] cannot write %s: %s\n", CONFIG_UNIT_PATH, strerror(errno));
    unlink(temporaryPath);
    return INSTALLER_ERROR_UNIT_WRITE_FAILED;
  }

  Sha256Context hash = Sha256I.create();
  Sha256I.update(&hash, unit, length);
  uint8_t digest[SHA256_DIGEST_LENGTH];
  Sha256I.finish(&hash, digest);
  char hex[SHA256_HEX_DIGEST_CAPACITY];
  Sha256I.formatHexDigest(digest, hex);
  char after[INSTALLER_TEXT_CAPACITY];
  if (!installerFits(
        snprintf(after, sizeof(after), "sha256:%s", hex), sizeof(after)
      )) {
    return INSTALLER_ERROR_UNIT_DESCRIPTION_TOO_LONG;
  }
  printf("wrote %s (%s)\n", CONFIG_UNIT_PATH, after);
  return installerRecord(run, "unit", before, after, INSTALLER_ERROR_UNIT_AUDIT_FAILED);
}

/** Create the directories the repairs and the Audit Trail live in. */
static InstallerResultCode installerEnsureDirectories(const InstallerRun *run) {
  /** First, so every later change has a place in the Audit Trail. */
  bool created = false;
  if (!installerMakeDirectory(CONFIG_DATA_DIRECTORY, &created)) {
    fprintf(stderr, "[error] cannot create %s: %s\n", CONFIG_DATA_DIRECTORY, strerror(errno));
    return INSTALLER_ERROR_DATA_DIRECTORY_FAILED;
  }
  if (created) {
    printf("created %s\n", CONFIG_DATA_DIRECTORY);
    const InstallerResultCode recorded =
      installerRecord(run, "data directory", INSTALLER_ABSENT_TEXT, "present", INSTALLER_ERROR_DATA_DIRECTORY_AUDIT_FAILED);
    if (recorded != INSTALLER_RESULT_OK) {
      return recorded;
    }
  }

  if (!installerMakeDirectory(CONFIG_BINARY_DIRECTORY, &created)) {
    fprintf(stderr, "[error] cannot create %s: %s\n", CONFIG_BINARY_DIRECTORY, strerror(errno));
    return INSTALLER_ERROR_BINARY_DIRECTORY_FAILED;
  }
  if (created) {
    printf("created %s\n", CONFIG_BINARY_DIRECTORY);
    return installerRecord(run, "binary directory", INSTALLER_ABSENT_TEXT, "present", INSTALLER_ERROR_BINARY_DIRECTORY_AUDIT_FAILED);
  }
  return INSTALLER_RESULT_OK;
}

/** "absent", or the digest of what is at `path` and is about to be replaced. */
static InstallerResultCode installerDescribeFile(
  const char *path, char *text, const size_t capacity
) {
  const int32_t descriptor = open(path, O_RDONLY | O_CLOEXEC);
  if (descriptor < 0 && errno == ENOENT) {
    snprintf(text, capacity, "%s", INSTALLER_ABSENT_TEXT);
    return INSTALLER_RESULT_OK;
  }
  if (descriptor < 0) {
    fprintf(stderr, "[error] cannot read %s: %s\n", path, strerror(errno));
    return INSTALLER_ERROR_PREVIOUS_CONTENT_UNREADABLE;
  }
  Sha256Context hash = Sha256I.create();
  uint8_t       chunk[INSTALLER_COPY_CHUNK_LENGTH];
  for (;;) {
    const ssize_t count = read(descriptor, chunk, sizeof(chunk));
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      fprintf(stderr, "[error] cannot read %s: %s\n", path, strerror(errno));
      close(descriptor);
      return INSTALLER_ERROR_PREVIOUS_CONTENT_READ_FAILED;
    }
    if (count == 0) {
      break;
    }
    Sha256I.update(&hash, chunk, (size_t)count);
  }
  close(descriptor);
  uint8_t digest[SHA256_DIGEST_LENGTH];
  Sha256I.finish(&hash, digest);
  char hex[SHA256_HEX_DIGEST_CAPACITY];
  Sha256I.formatHexDigest(digest, hex);
  return installerFits(snprintf(text, capacity, "sha256:%s", hex), capacity)
         ? INSTALLER_RESULT_OK
         : INSTALLER_ERROR_PREVIOUS_CONTENT_TEXT_TOO_LONG;
}

static InstallerResultCode installerRepair(
  const InstallerRun *run, const InstallationRepairs *repairs
) {
  InstallerResultCode code = installerEnsureDirectories(run);
  if (code != INSTALLER_RESULT_OK) {
    return code;
  }
  if (repairs->binary) {
    char before[INSTALLER_TEXT_CAPACITY];
    code = installerDescribeFile(CONFIG_BINARY_PATH, before, sizeof(before));
    if (code == INSTALLER_RESULT_OK) {
      code = installerInstallBinary(run, before);
    }
    if (code != INSTALLER_RESULT_OK) {
      return code;
    }
  }
  if (repairs->unit) {
    char before[INSTALLER_TEXT_CAPACITY];
    code = installerDescribeFile(CONFIG_UNIT_PATH, before, sizeof(before));
    if (code == INSTALLER_RESULT_OK) {
      code = installerInstallUnit(run, before);
    }
    if (code != INSTALLER_RESULT_OK) {
      return code;
    }
    if (!installerRunSystemctl("daemon-reload", NULL)) {
      fprintf(stderr, "[error] systemctl daemon-reload failed\n");
      return INSTALLER_ERROR_RELOAD_FAILED;
    }
  }

  /**
   * Asked now, not before: while the unit was missing or wrong systemd could
   * not say, and restoring the unit often restores the enablement with it.
   */
  const bool enabled = installerRunSystemctl("is-enabled", CONFIG_SERVICE_NAME);
  if (!enabled) {
    if (!installerRunSystemctl("enable", CONFIG_SERVICE_NAME)) {
      fprintf(stderr, "[error] systemctl enable %s failed\n", CONFIG_SERVICE_NAME);
      return INSTALLER_ERROR_ENABLE_FAILED;
    }
    printf("enabled %s\n", CONFIG_SERVICE_NAME);
    code = installerRecord(run, "service enablement", "not enabled", "enabled", INSTALLER_ERROR_ENABLE_AUDIT_FAILED);
    if (code != INSTALLER_RESULT_OK) {
      return code;
    }
  }

  /** A running service is left alone: only a stopped one is started. */
  if (installerRunSystemctl("is-active", CONFIG_SERVICE_NAME)) {
    return INSTALLER_RESULT_OK;
  }
  if (!installerRunSystemctl("start", CONFIG_SERVICE_NAME)) {
    fprintf(stderr, "[error] systemctl start %s failed\n", CONFIG_SERVICE_NAME);
    return INSTALLER_ERROR_START_FAILED;
  }
  /** Recorded either way: the service was started, whatever it did next. */
  const bool active = installerRunSystemctl("is-active", CONFIG_SERVICE_NAME);
  code = installerRecord(
    run,
    "service state",
    "inactive",
    active ? "active" : "started, not active",
    INSTALLER_ERROR_STATE_AUDIT_FAILED
  );
  if (code != INSTALLER_RESULT_OK) {
    return code;
  }
  if (!active) {
    fprintf(stderr, "[error] %s started but is not active\n", CONFIG_SERVICE_NAME);
    return INSTALLER_ERROR_NOT_ACTIVE;
  }
  printf("started %s\n", CONFIG_SERVICE_NAME);
  return INSTALLER_RESULT_OK;
}

/** The first bytes of the ELF header, or false when the file has fewer. */
static bool installerReadElfHeader(const char *path, uint8_t *header) {
  const int32_t descriptor = open(path, O_RDONLY | O_CLOEXEC);
  if (descriptor < 0) {
    return false;
  }
  size_t totalRead = 0;
  while (totalRead < SELF_UPDATE_ELF_HEADER_LENGTH) {
    const ssize_t count =
      read(descriptor, header + totalRead, SELF_UPDATE_ELF_HEADER_LENGTH - totalRead);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      break;
    }
    totalRead += (size_t)count;
  }
  close(descriptor);
  return totalRead == SELF_UPDATE_ELF_HEADER_LENGTH;
}

/** The same check self-update applies to a downloaded binary. */
static InstallerResultCode installerCheckBinary(
  const char *runningPath, bool *valid
) {
  uint8_t running[SELF_UPDATE_ELF_HEADER_LENGTH];
  if (!installerReadElfHeader(runningPath, running)) {
    fprintf(stderr, "[error] cannot read the header of %s\n", runningPath);
    return INSTALLER_ERROR_RUNNING_HEADER_UNREADABLE;
  }
  uint8_t installed[SELF_UPDATE_ELF_HEADER_LENGTH];
  *valid = installerReadElfHeader(CONFIG_BINARY_PATH, installed)
        && SelfUpdateI.checkCompatibility(installed, running) == SELF_UPDATE_RESULT_OK;
  return INSTALLER_RESULT_OK;
}

static bool installerUnitMatches(void) {
  char          content[INSTALLATION_UNIT_CAPACITY];
  const int32_t descriptor = open(CONFIG_UNIT_PATH, O_RDONLY | O_CLOEXEC);
  if (descriptor < 0) {
    return false;
  }
  /** One byte more than the unit: a longer file cannot be the unit. */
  size_t total = 0;
  while (total < sizeof(content)) {
    const ssize_t count = read(descriptor, content + total, sizeof(content) - total);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      break;
    }
    total += (size_t)count;
  }
  close(descriptor);
  return InstallationI.isExpectedUnit(content, total);
}

/** Run the installed binary with `--version` and keep its first line. */
static InstallerResultCode installerReadInstalledVersion(char *version, const size_t capacity) {
  int32_t pipeEnds[2];
  if (pipe(pipeEnds) != 0 || fcntl(pipeEnds[0], F_SETFD, FD_CLOEXEC) != 0
      || fcntl(pipeEnds[1], F_SETFD, FD_CLOEXEC) != 0) {
    return INSTALLER_ERROR_VERSION_PIPE_FAILED;
  }
  posix_spawn_file_actions_t actions;
  posix_spawn_file_actions_init(&actions);
  posix_spawn_file_actions_adddup2(&actions, pipeEnds[1], STDOUT_FILENO);
  char  program[] = CONFIG_BINARY_PATH;
  char  option[]  = INSTALLER_VERSION_OPTION;
  char *arguments[] = {program, option, NULL};
  pid_t         child  = 0;
  const int32_t status = posix_spawn(&child, CONFIG_BINARY_PATH, &actions, NULL, arguments, environ);
  posix_spawn_file_actions_destroy(&actions);
  close(pipeEnds[1]);
  if (status != 0) {
    close(pipeEnds[0]);
    fprintf(stderr, "[error] cannot run %s: %s\n", CONFIG_BINARY_PATH, strerror(status));
    return INSTALLER_ERROR_VERSION_UNKNOWN;
  }
  size_t length = 0;
  for (;;) {
    const ssize_t count = read(pipeEnds[0], version + length, capacity - 1 - length);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0 || (length += (size_t)count) >= capacity - 1) {
      break;
    }
  }
  close(pipeEnds[0]);
  int32_t exitStatus = 0;
  waitpid(child, &exitStatus, 0);
  version[length] = '\0';
  char *lineEnd = strchr(version, '\n');
  if (lineEnd != NULL) {
    *lineEnd = '\0';
  }
  if (!WIFEXITED(exitStatus) || WEXITSTATUS(exitStatus) != 0 || version[0] == '\0') {
    fprintf(stderr, "[error] %s did not report its version\n", CONFIG_BINARY_PATH);
    return INSTALLER_ERROR_VERSION_REPORT_INVALID;
  }
  return INSTALLER_RESULT_OK;
}

/** Everything is in place: say how it is, write nothing. */
static InstallerResultCode installerReportStatus(void) {
  char version[INSTALLER_VERSION_CAPACITY];
  const InstallerResultCode versionCode = installerReadInstalledVersion(version, sizeof(version));
  if (versionCode != INSTALLER_RESULT_OK) {
    return versionCode;
  }

  ConfigSourceStorage    sourceStorage;
  const ConfigSources    sources = ConfigI.readSources(&sourceStorage);
  PuppetConfig           config;
  const ConfigResultCode configCode = ConfigI.resolve(&sources, &config);
  if (configCode != CONFIG_RESULT_OK) {
    fprintf(stderr, "[error] cannot determine the Device identifier (%d)\n", configCode);
    return INSTALLER_ERROR_DEVICE_IDENTIFIER_UNKNOWN;
  }

  char enrollment[INSTALLER_ENROLLMENT_CAPACITY];
  const AuditTrailResultCode trailCode = AuditTrailI.readLatestAfter(
    CONFIG_AUDIT_TRAIL_PATH, "enrollment", enrollment, sizeof(enrollment)
  );
  if (trailCode != AUDIT_TRAIL_RESULT_OK && trailCode != AUDIT_TRAIL_ERROR_NO_ENTRY) {
    fprintf(stderr, "[error] cannot read %s (%d)\n", CONFIG_AUDIT_TRAIL_PATH, trailCode);
    return INSTALLER_ERROR_ENROLLMENT_UNREADABLE;
  }

  const bool active = installerRunSystemctl("is-active", CONFIG_SERVICE_NAME);
  printf("the Puppet is installed and intact; nothing was changed\n");
  printf("  installed version:  %s\n", version);
  printf("  service:            enabled, %s\n", active ? "active" : "not active");
  printf(
    "  enrollment:         %s\n",
    trailCode == AUDIT_TRAIL_RESULT_OK ? enrollment : "not recorded yet"
  );
  printf("  device identifier:  %s\n", config.deviceIdentifier);
  return INSTALLER_RESULT_OK;
}

static InstallerResultCode installerRun(const InstallerContext *context) {
  bool binaryValid = false;
  const InstallerResultCode checked = installerCheckBinary(context->executablePath, &binaryValid);
  if (checked != INSTALLER_RESULT_OK) {
    return checked;
  }
  const InstallationFacts facts = {
    .binaryValid    = binaryValid,
    .unitMatches    = installerUnitMatches(),
    .serviceEnabled = installerRunSystemctl("is-enabled", CONFIG_SERVICE_NAME),
  };
  const InstallationRepairs repairs = InstallationI.diagnose(&facts);
  if (!InstallationI.needsRepair(&repairs)) {
    return installerReportStatus();
  }

  if (geteuid() != 0) {
    return installerElevate(context->executablePath);
  }

  const bool bySudo = context->sudoUser != NULL && context->sudoUser[0] != '\0';
  const InstallerRun run = {
    .context = context,
    .actor   = {
      .kind       = AUDIT_TRAIL_ACTOR_USER,
      .identifier = bySudo ? context->sudoUser : INSTALLER_ROOT_USER,
    },
  };
  return installerRepair(&run, &repairs);
}

const struct InstallerType InstallerI = {
  .run = installerRun,
};
