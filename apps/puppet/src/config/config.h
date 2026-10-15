/**
 * @file config.h
 * @brief Configuration of a Puppet, fixed when it is built (ADR-0001).
 *
 * The Puppet reads no environment variables. Puppeteer's URL is given to
 * CMake (`-DPUPPET_SERVER_URL=...`, validated at configure time) and reaches
 * the code as the `PUPPET_SERVER_URL` compile definition. Every path is a
 * constant below. The Device identity is always `/etc/machine-id`.
 *
 * Resolution is split in two so the rules stay pure and testable:
 * `ConfigI.readSources` performs the IO (the machine id file) and
 * `ConfigI.resolve` applies validation.
 */
#ifndef PUPPET_CONFIG_H_
#define PUPPET_CONFIG_H_

#include <stdbool.h>
#include <stddef.h>

/**
 * Layout of the Installation. Every name visible to the operating system
 * carries the `dsrs-` prefix so it never collides with Debian's `puppet`
 * package.
 */
#define CONFIG_BINARY_PATH     "/opt/dsrs-puppet/puppet"
#define CONFIG_DATA_DIRECTORY  "/var/lib/dsrs-puppet"
#define CONFIG_UNIT_PATH       "/etc/systemd/system/dsrs-puppet.service"
#define CONFIG_AGENT_LOCK_PATH "/run/dsrs-puppet.lock"

#define CONFIG_SERVER_URL_CAPACITY        ((size_t)256)
#define CONFIG_DEVICE_IDENTIFIER_CAPACITY ((size_t)128)

typedef enum {
  CONFIG_RESULT_OK = 0,

  /** The Puppeteer URL is empty. */
  CONFIG_ERROR_MISSING_SERVER_URL = 3001,
  /** The Puppeteer URL is not an http:// or https:// URL. */
  CONFIG_ERROR_INVALID_SERVER_URL = 3002,
  /** The Puppeteer URL exceeds `CONFIG_SERVER_URL_CAPACITY`. */
  CONFIG_ERROR_SERVER_URL_TOO_LONG = 3003,
  /** The machine id is missing or empty. */
  CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER = 3007,
  /** The machine id exceeds `CONFIG_DEVICE_IDENTIFIER_CAPACITY`. */
  CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG = 3008,
} ConfigResultCode;

/**
 * Raw inputs to configuration. Each field is NULL (or empty) when
 * unavailable. Strings are borrowed and must outlive the `resolve` call.
 */
typedef struct {
  /** Puppeteer's URL, as given to CMake at build time. */
  const char *serverUrl;

  /** Contents of the system's machine id, without trailing whitespace. */
  const char *machineIdentifier;
} ConfigSources;

typedef struct {
  /** Base URL without a trailing slash, e.g. "https://puppeteer.example". */
  char serverUrl[CONFIG_SERVER_URL_CAPACITY];

  char deviceIdentifier[CONFIG_DEVICE_IDENTIFIER_CAPACITY];
} PuppetConfig;

/**
 * Storage the shell fills with sources it had to read from files. Keep it
 * alive for as long as the `ConfigSources` that borrow from it.
 */
typedef struct {
  char machineIdentifier[CONFIG_DEVICE_IDENTIFIER_CAPACITY];
} ConfigSourceStorage;

struct ConfigType {
  /**
   * Gather the build-time URL and the machine id file. Never fails: an
   * unreadable machine id is left empty for `resolve` to judge.
   */
  ConfigSources (*const readSources)(ConfigSourceStorage *storage);

  /** Validate `sources`, filling `config`. */
  ConfigResultCode (*const resolve)(
    const ConfigSources *sources, PuppetConfig *config
  );
};

extern const struct ConfigType ConfigI;

#ifdef PUPPET_CONFIG_IMPLEMENTATION
#include "config.c"
#endif

#endif // PUPPET_CONFIG_H_
