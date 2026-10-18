#include "config/config.h"
#include "testing/testing.h"

#include <string.h>

static ConfigSources configTestMinimalSources(void) {
  return (ConfigSources){
    .serverUrl         = "https://puppeteer.example/",
    .machineIdentifier = "0123abcd",
  };
}

static void configResolvesTheMinimalSources(TestContext *context) {
  const ConfigSources sources = configTestMinimalSources();
  PuppetConfig        config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(context, strcmp(config.serverUrl, "https://puppeteer.example") == 0);
  EXPECT(context, strcmp(config.deviceIdentifier, "0123abcd") == 0);
}

static void configFixesThePathsAtCompileTime(TestContext *context) {
  EXPECT(context, strcmp(CONFIG_BINARY_PATH, "/opt/dsrs-puppet/puppet") == 0);
  EXPECT(context, strcmp(CONFIG_DATA_DIRECTORY, "/var/lib/dsrs-puppet") == 0);
  EXPECT(
    context,
    strcmp(CONFIG_UNIT_PATH, "/etc/systemd/system/dsrs-puppet.service") == 0
  );
  EXPECT(context, strcmp(CONFIG_AGENT_LOCK_PATH, "/run/dsrs-puppet.lock") == 0);
}

static void configAlwaysUsesTheMachineIdentifier(TestContext *context) {
  const ConfigSources sources = configTestMinimalSources();
  PuppetConfig        config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(
    context, strcmp(config.deviceIdentifier, sources.machineIdentifier) == 0
  );
}

static void configRejectsInvalidSources(TestContext *context) {
  PuppetConfig config;

  ConfigSources missingUrl = configTestMinimalSources();
  missingUrl.serverUrl     = NULL;
  EXPECT(
    context,
    ConfigI.resolve(&missingUrl, &config) == CONFIG_ERROR_MISSING_SERVER_URL
  );

  ConfigSources emptyUrl = configTestMinimalSources();
  emptyUrl.serverUrl     = "";
  EXPECT(
    context,
    ConfigI.resolve(&emptyUrl, &config) == CONFIG_ERROR_MISSING_SERVER_URL
  );

  ConfigSources invalidUrl = configTestMinimalSources();
  invalidUrl.serverUrl     = "puppeteer.example";
  EXPECT(
    context,
    ConfigI.resolve(&invalidUrl, &config) == CONFIG_ERROR_INVALID_SERVER_URL
  );

  ConfigSources noMachineIdentifier     = configTestMinimalSources();
  noMachineIdentifier.machineIdentifier = "";
  EXPECT(
    context,
    ConfigI.resolve(&noMachineIdentifier, &config)
      == CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER
  );

  ConfigSources unreadableMachineIdentifier     = configTestMinimalSources();
  unreadableMachineIdentifier.machineIdentifier = NULL;
  EXPECT(
    context,
    ConfigI.resolve(&unreadableMachineIdentifier, &config)
      == CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER
  );
}

static void configRejectsOversizedValues(TestContext *context) {
  char oversized[CONFIG_SERVER_URL_CAPACITY + 16];
  memset(oversized, 'a', sizeof(oversized) - 1); // deliberately filled test input
  memcpy(oversized, "https://", strlen("https://"));
  oversized[sizeof(oversized) - 1] = '\0';

  ConfigSources sources = configTestMinimalSources();
  sources.serverUrl     = oversized;
  PuppetConfig config;

  EXPECT(
    context,
    ConfigI.resolve(&sources, &config) == CONFIG_ERROR_SERVER_URL_TOO_LONG
  );

  /** One character past `CONFIG_DEVICE_IDENTIFIER_CAPACITY` and then some. */
  const char *const oversizedIdentifier =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  ConfigSources longIdentifier     = configTestMinimalSources();
  longIdentifier.machineIdentifier = oversizedIdentifier;
  EXPECT(
    context,
    ConfigI.resolve(&longIdentifier, &config)
      == CONFIG_ERROR_DEVICE_IDENTIFIER_TOO_LONG
  );
}

static const TestCase CONFIG_TEST_CASES[] = {
  {"resolves the minimal sources", configResolvesTheMinimalSources},
  {"fixes the paths at compile time", configFixesThePathsAtCompileTime},
  {"always identifies the Device by the machine id", configAlwaysUsesTheMachineIdentifier},
  {"rejects missing or invalid sources", configRejectsInvalidSources},
  {"rejects oversized values instead of truncating", configRejectsOversizedValues},
};

static const TestSuite ConfigTestSuite = {
  .name      = "config",
  .cases     = CONFIG_TEST_CASES,
  .caseCount = sizeof(CONFIG_TEST_CASES) / sizeof(CONFIG_TEST_CASES[0]),
};
