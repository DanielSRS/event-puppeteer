/**
 * @file config.h
 * @brief Runtime configuration of a Puppet.
 *
 * Following the zero-touch Enrollment model (ADR-0002), a Puppet only needs
 * to know where Puppeteer is. Everything else has a sensible default.
 *
 * | Variable                   | Meaning                                        | Default                                   |
 * |----------------------------|------------------------------------------------|-------------------------------------------|
 * | `PUPPET_SERVER_URL`        | Base URL of Puppeteer (http:// or https://)    | required                                  |
 * | `PUPPET_ORGANIZATION_ID`   | Organization to request Enrollment into        | none (Superadmin queue)                   |
 * | `PUPPET_DATA_DIRECTORY`    | Where credentials and the feed are persisted   | `$XDG_DATA_HOME/puppet`, else `$HOME/.local/share/puppet` |
 * | `PUPPET_DEVICE_IDENTIFIER` | Stable identity announced on connect           | contents of `/etc/machine-id`             |
 *
 * Resolution is split in two so the rules stay pure and testable:
 * `ConfigI.readSources` performs the IO (environment, machine id) and
 * `ConfigI.resolve` applies defaults and validation.
 */
#ifndef PUPPET_CONFIG_H_
#define PUPPET_CONFIG_H_

#include <stdbool.h>
#include <stddef.h>

#define CONFIG_SERVER_URL_CAPACITY        ((size_t)256)
#define CONFIG_ORGANIZATION_ID_CAPACITY   ((size_t)64)
#define CONFIG_DATA_DIRECTORY_CAPACITY    ((size_t)512)
#define CONFIG_DEVICE_IDENTIFIER_CAPACITY ((size_t)128)

typedef enum {
  CONFIG_RESULT_OK = 0,

  /** `PUPPET_SERVER_URL` is not set. */
  CONFIG_ERROR_MISSING_SERVER_URL = 3001,
  /** `PUPPET_SERVER_URL` is not an http:// or https:// URL. */
  CONFIG_ERROR_INVALID_SERVER_URL = 3002,
  /** `PUPPET_SERVER_URL` exceeds `CONFIG_SERVER_URL_CAPACITY`. */
  CONFIG_ERROR_SERVER_URL_TOO_LONG = 3003,
  /** `PUPPET_ORGANIZATION_ID` exceeds its capacity. */
  CONFIG_ERROR_ORGANIZATION_ID_TOO_LONG = 3004,
  /** No data directory is set and `HOME` is unknown. */
  CONFIG_ERROR_MISSING_DATA_DIRECTORY = 3005,
  /** The data directory path exceeds its capacity. */
  CONFIG_ERROR_DATA_DIRECTORY_TOO_LONG = 3006,
  /** No identifier is set and the machine id is unavailable. */
  CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER = 3007,
  /** The device identifier exceeds its capacity. */
  CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG = 3008,
} ConfigResultCode;

/**
 * Raw inputs to configuration. Each field is NULL (or empty) when unset.
 * Strings are borrowed and must outlive the `resolve` call.
 */
typedef struct {
  const char *serverUrl;
  const char *organizationId;
  const char *dataDirectory;
  const char *deviceIdentifier;

  /** `XDG_DATA_HOME` and `HOME`, used to derive the default data directory. */
  const char *dataHome;
  const char *home;

  /** Contents of the system's machine id, without trailing whitespace. */
  const char *machineIdentifier;
} ConfigSources;

typedef struct {
  /** Base URL without a trailing slash, e.g. "https://puppeteer.example". */
  char serverUrl[CONFIG_SERVER_URL_CAPACITY];

  bool hasOrganization;
  char organizationId[CONFIG_ORGANIZATION_ID_CAPACITY];

  char dataDirectory[CONFIG_DATA_DIRECTORY_CAPACITY];
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
   * Gather sources from the process environment and the machine id file.
   * Never fails: unavailable sources are left NULL for `resolve` to judge.
   */
  ConfigSources (*const readSources)(ConfigSourceStorage *storage);

  /** Apply defaults and validation to `sources`, filling `config`. */
  ConfigResultCode (*const resolve)(
    const ConfigSources *sources, PuppetConfig *config
  );
};

extern const struct ConfigType ConfigI;

#ifdef PUPPET_CONFIG_IMPLEMENTATION
#include "config.c"
#endif

#endif // PUPPET_CONFIG_H_
