#include "self-update.h"

#include <fcntl.h>
#include <libgen.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

/** Linux exposes the running executable through this symbolic link. */
#define SELF_UPDATE_RUNNING_EXECUTABLE_LINK "/proc/self/exe"

#define SELF_UPDATE_STAGING_SUFFIX ".update"

/** rwxr-xr-x: the usual mode for an installed program. */
#define SELF_UPDATE_EXECUTABLE_MODE ((mode_t)0755)

/** Read size used while hashing the staged file. */
#define SELF_UPDATE_HASH_CHUNK_LENGTH ((size_t)16384)

/** e_ident bytes that must match: magic (4), class, byte order, version. */
#define SELF_UPDATE_ELF_IDENTITY_LENGTH ((size_t)7)

/** Offset and size of e_machine, identical in 32- and 64-bit headers. */
#define SELF_UPDATE_ELF_MACHINE_OFFSET ((size_t)18)
#define SELF_UPDATE_ELF_MACHINE_LENGTH ((size_t)2)

static const uint8_t SELF_UPDATE_ELF_MAGIC[] = {0x7f, 'E', 'L', 'F'};

static SelfUpdateResultCode selfUpdateResolvePaths(SelfUpdatePaths *paths) {
  const ssize_t length = readlink(
    SELF_UPDATE_RUNNING_EXECUTABLE_LINK,
    paths->executablePath,
    sizeof(paths->executablePath) - 1
  );
  if (length <= 0) {
    return SELF_UPDATE_ERROR_EXECUTABLE_PATH_UNKNOWN;
  }
  paths->executablePath[length] = '\0';

  const int32_t written = snprintf(
    paths->stagingPath,
    sizeof(paths->stagingPath),
    "%s" SELF_UPDATE_STAGING_SUFFIX,
    paths->executablePath
  );
  if (written < 0 || (size_t)written >= sizeof(paths->stagingPath)) {
    return SELF_UPDATE_ERROR_PATH_TOO_LONG;
  }
  return SELF_UPDATE_RESULT_OK;
}

static SelfUpdateResultCode selfUpdateCheckCompatibility(
  const uint8_t *candidate, const uint8_t *running
) {
  if (memcmp(candidate, SELF_UPDATE_ELF_MAGIC, sizeof(SELF_UPDATE_ELF_MAGIC)) != 0) {
    return SELF_UPDATE_ERROR_NOT_AN_EXECUTABLE;
  }
  const bool sameIdentity =
    memcmp(candidate, running, SELF_UPDATE_ELF_IDENTITY_LENGTH) == 0;
  const bool sameMachine =
    memcmp(
      candidate + SELF_UPDATE_ELF_MACHINE_OFFSET,
      running + SELF_UPDATE_ELF_MACHINE_OFFSET,
      SELF_UPDATE_ELF_MACHINE_LENGTH
    )
    == 0;
  return sameIdentity && sameMachine ? SELF_UPDATE_RESULT_OK
                                     : SELF_UPDATE_ERROR_ARCHITECTURE_MISMATCH;
}

static bool selfUpdateReadHeader(const char *path, uint8_t *header) {
  FILE *file = fopen(path, "rb");
  if (file == NULL) {
    return false;
  }
  const size_t read = fread(header, 1, SELF_UPDATE_ELF_HEADER_LENGTH, file);
  fclose(file);
  return read == SELF_UPDATE_ELF_HEADER_LENGTH;
}

static bool selfUpdateHashFile(const char *path, uint8_t *digest) {
  FILE *file = fopen(path, "rb");
  if (file == NULL) {
    return false;
  }
  Sha256Context context = Sha256I.create();
  uint8_t       chunk[SELF_UPDATE_HASH_CHUNK_LENGTH];
  size_t        read = 0;
  while ((read = fread(chunk, 1, sizeof(chunk), file)) > 0) {
    Sha256I.update(&context, chunk, read);
  }
  const bool failed = ferror(file) != 0;
  fclose(file);
  Sha256I.finish(&context, digest);
  return !failed;
}

/** Flush a file or directory to stable storage. */
static bool selfUpdateSync(const char *path, const int32_t openFlags) {
  const int32_t descriptor = open(path, openFlags);
  if (descriptor < 0) {
    return false;
  }
  const bool synced = fsync(descriptor) == 0;
  close(descriptor);
  return synced;
}

static SelfUpdateResultCode selfUpdateVerify(
  const SelfUpdatePaths *paths, const uint8_t *expectedDigest
) {
  uint8_t digest[SHA256_DIGEST_LENGTH];
  if (!selfUpdateHashFile(paths->stagingPath, digest)) {
    return SELF_UPDATE_ERROR_STAGED_FILE_UNREADABLE;
  }
  if (memcmp(digest, expectedDigest, SHA256_DIGEST_LENGTH) != 0) {
    return SELF_UPDATE_ERROR_DIGEST_MISMATCH;
  }

  uint8_t candidateHeader[SELF_UPDATE_ELF_HEADER_LENGTH];
  if (!selfUpdateReadHeader(paths->stagingPath, candidateHeader)) {
    return SELF_UPDATE_ERROR_NOT_AN_EXECUTABLE;
  }
  uint8_t runningHeader[SELF_UPDATE_ELF_HEADER_LENGTH];
  if (!selfUpdateReadHeader(SELF_UPDATE_RUNNING_EXECUTABLE_LINK, runningHeader)) {
    return SELF_UPDATE_ERROR_RUNNING_EXECUTABLE_UNREADABLE;
  }
  return selfUpdateCheckCompatibility(candidateHeader, runningHeader);
}

static SelfUpdateResultCode selfUpdateReplace(const SelfUpdatePaths *paths) {
  if (chmod(paths->stagingPath, SELF_UPDATE_EXECUTABLE_MODE) != 0
      || !selfUpdateSync(paths->stagingPath, O_RDONLY)) {
    return SELF_UPDATE_ERROR_PREPARATION_FAILED;
  }
  if (rename(paths->stagingPath, paths->executablePath) != 0) {
    return SELF_UPDATE_ERROR_REPLACE_FAILED;
  }

  /** dirname may modify its argument, hence the copy. Persisting the
   *  directory entry is best effort: the rename itself already happened. */
  char directory[SELF_UPDATE_PATH_CAPACITY];
  memcpy(directory, paths->executablePath, sizeof(directory));
  selfUpdateSync(dirname(directory), O_RDONLY | O_DIRECTORY);
  return SELF_UPDATE_RESULT_OK;
}

static void selfUpdateDiscardStaged(const SelfUpdatePaths *paths) {
  unlink(paths->stagingPath);
}

static SelfUpdateResultCode selfUpdateInstall(
  const SelfUpdatePaths *paths, const uint8_t *expectedDigest
) {
  SelfUpdateResultCode code = selfUpdateVerify(paths, expectedDigest);
  if (code == SELF_UPDATE_RESULT_OK) {
    code = selfUpdateReplace(paths);
  }
  if (code != SELF_UPDATE_RESULT_OK) {
    selfUpdateDiscardStaged(paths);
  }
  return code;
}

static void selfUpdateRestart(
  const SelfUpdatePaths *paths, char *const arguments[]
) {
  execv(paths->executablePath, arguments);
}

const struct SelfUpdateType SelfUpdateI = {
  .resolvePaths       = selfUpdateResolvePaths,
  .checkCompatibility = selfUpdateCheckCompatibility,
  .install            = selfUpdateInstall,
  .discardStaged      = selfUpdateDiscardStaged,
  .restart            = selfUpdateRestart,
};
