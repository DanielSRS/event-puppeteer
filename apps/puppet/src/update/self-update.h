/**
 * @file self-update.h
 * @brief Replaces the running Puppet binary and restarts into it.
 *
 * Backs the `update` Command. The agent downloads the new binary to
 * `SelfUpdatePaths.stagingPath` (next to the executable, so the final
 * `rename` is atomic on the same filesystem), then calls `install`, which:
 *
 * 1. verifies the SHA-256 digest supplied by Puppeteer;
 * 2. checks the file is an ELF executable for the same architecture as the
 *    running one, so a wrong build can never brick a Device;
 * 3. makes it executable and flushes it to disk;
 * 4. atomically renames it over the current executable and flushes the
 *    directory, so a power cut leaves either the old or the new binary.
 *
 * Finally `restart` replaces the process image with the new binary (same
 * PID, same arguments), which works with or without a service manager.
 *
 * The Puppet's user must be able to write the executable's directory.
 *
 * This default implementation targets Linux (`/proc/self/exe`).
 */
#ifndef PUPPET_SELF_UPDATE_H_
#define PUPPET_SELF_UPDATE_H_

#include "crypto/sha256.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define SELF_UPDATE_PATH_CAPACITY ((size_t)512)

/**
 * Bytes of an ELF header that identify the binary's format and target:
 * magic, class, byte order and version (e_ident[0..6]) and, at offset 18,
 * the machine (e_machine).
 */
#define SELF_UPDATE_ELF_HEADER_LENGTH ((size_t)20)

typedef enum {
  SELF_UPDATE_RESULT_OK = 0,

  /** The running executable's path could not be determined. */
  SELF_UPDATE_ERROR_EXECUTABLE_PATH_UNKNOWN = 4001,
  /** The executable path leaves no room for the staging suffix. */
  SELF_UPDATE_ERROR_PATH_TOO_LONG = 4002,
  /** The downloaded file could not be read. */
  SELF_UPDATE_ERROR_STAGED_FILE_UNREADABLE = 4003,
  /** The downloaded file does not match the expected SHA-256. */
  SELF_UPDATE_ERROR_DIGEST_MISMATCH = 4004,
  /** The downloaded file is not an ELF executable. */
  SELF_UPDATE_ERROR_NOT_AN_EXECUTABLE = 4005,
  /** The downloaded binary targets another architecture or ABI. */
  SELF_UPDATE_ERROR_ARCHITECTURE_MISMATCH = 4006,
  /** The running executable could not be read for comparison. */
  SELF_UPDATE_ERROR_RUNNING_EXECUTABLE_UNREADABLE = 4007,
  /** The downloaded file could not be made executable or flushed. */
  SELF_UPDATE_ERROR_PREPARATION_FAILED = 4008,
  /** The new binary could not replace the current one. */
  SELF_UPDATE_ERROR_REPLACE_FAILED = 4009,
} SelfUpdateResultCode;

typedef struct {
  /** Absolute path of the running executable. */
  char executablePath[SELF_UPDATE_PATH_CAPACITY];

  /** Where the update is downloaded before installation. */
  char stagingPath[SELF_UPDATE_PATH_CAPACITY];
} SelfUpdatePaths;

struct SelfUpdateType {
  /**
   * Determine the executable and staging paths. Call at startup: once the
   * binary is replaced, the kernel no longer reports the original path.
   */
  SelfUpdateResultCode (*const resolvePaths)(SelfUpdatePaths *paths);

  /**
   * Whether `candidate` (the first `SELF_UPDATE_ELF_HEADER_LENGTH` bytes of
   * a file) is an ELF binary runnable wherever `running` is. Pure.
   */
  SelfUpdateResultCode (*const checkCompatibility)(
    const uint8_t *candidate, const uint8_t *running
  );

  /**
   * Verify the staged download and install it over the executable. The
   * staged file is removed on failure.
   */
  SelfUpdateResultCode (*const install)(
    const SelfUpdatePaths *paths, const uint8_t *expectedDigest
  );

  /** Remove a staged download, if any. */
  void (*const discardStaged)(const SelfUpdatePaths *paths);

  /**
   * Replace the current process with the installed executable. Release
   * every resource that must be flushed (storage, network) beforehand.
   * Returns only if the restart failed.
   *
   * @param arguments  The original `argv` (NULL-terminated).
   */
  void (*const restart)(const SelfUpdatePaths *paths, char *const arguments[]);
};

extern const struct SelfUpdateType SelfUpdateI;

#ifdef PUPPET_SELF_UPDATE_IMPLEMENTATION
#include "self-update.c"
#endif

#endif // PUPPET_SELF_UPDATE_H_
