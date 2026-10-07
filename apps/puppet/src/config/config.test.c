#include "config/config.h"
#include "testing/testing.h"

#include <string.h>

static ConfigSources configTestMinimalSources(void) {
  return (ConfigSources){
    .serverUrl         = "https://puppeteer.example/",
    .organizationId    = NULL,
    .dataDirectory     = NULL,
    .deviceIdentifier  = NULL,
    .dataHome          = NULL,
    .home              = "/home/kiosk",
    .machineIdentifier = "0123abcd",
  };
}

static void configAppliesDefaults(TestContext *context) {
  const ConfigSources sources = configTestMinimalSources();
  PuppetConfig        config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(context, strcmp(config.serverUrl, "https://puppeteer.example") == 0);
  EXPECT(context, !config.hasOrganization);
  EXPECT(context, strcmp(config.dataDirectory, "/home/kiosk/.local/share/puppet") == 0);
  EXPECT(context, strcmp(config.deviceIdentifier, "0123abcd") == 0);
}

static void configPrefersExplicitValues(TestContext *context) {
  ConfigSources sources    = configTestMinimalSources();
  sources.organizationId   = "org-9";
  sources.dataDirectory    = "/var/lib/puppet";
  sources.deviceIdentifier = "hall-a";
  PuppetConfig config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(context, config.hasOrganization);
  EXPECT(context, strcmp(config.organizationId, "org-9") == 0);
  EXPECT(context, strcmp(config.dataDirectory, "/var/lib/puppet") == 0);
  EXPECT(context, strcmp(config.deviceIdentifier, "hall-a") == 0);
}

static void configUsesXdgDataHome(TestContext *context) {
  ConfigSources sources = configTestMinimalSources();
  sources.dataHome      = "/data";
  PuppetConfig config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(context, strcmp(config.dataDirectory, "/data/puppet") == 0);
}

static void configTreatsEmptyAsUnset(TestContext *context) {
  ConfigSources sources  = configTestMinimalSources();
  sources.organizationId = "";
  PuppetConfig config;

  EXPECT(context, ConfigI.resolve(&sources, &config) == CONFIG_RESULT_OK);
  EXPECT(context, !config.hasOrganization);
}

static void configRejectsInvalidSources(TestContext *context) {
  PuppetConfig config;

  ConfigSources missingUrl = configTestMinimalSources();
  missingUrl.serverUrl     = NULL;
  EXPECT(
    context,
    ConfigI.resolve(&missingUrl, &config) == CONFIG_ERROR_MISSING_SERVER_URL
  );

  ConfigSources invalidUrl = configTestMinimalSources();
  invalidUrl.serverUrl     = "puppeteer.example";
  EXPECT(
    context,
    ConfigI.resolve(&invalidUrl, &config) == CONFIG_ERROR_INVALID_SERVER_URL
  );

  ConfigSources noHome = configTestMinimalSources();
  noHome.home          = NULL;
  EXPECT(
    context,
    ConfigI.resolve(&noHome, &config) == CONFIG_ERROR_MISSING_DATA_DIRECTORY
  );

  ConfigSources noIdentity     = configTestMinimalSources();
  noIdentity.machineIdentifier = "";
  EXPECT(
    context,
    ConfigI.resolve(&noIdentity, &config) == CONFIG_ERROR_MISSING_DEVICE_IDENTIFIER
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
}

static const TestCase CONFIG_TEST_CASES[] = {
  {"applies defaults to the minimal sources", configAppliesDefaults},
  {"prefers explicit values", configPrefersExplicitValues},
  {"derives the data directory from XDG_DATA_HOME", configUsesXdgDataHome},
  {"treats empty values as unset", configTreatsEmptyAsUnset},
  {"rejects missing or invalid sources", configRejectsInvalidSources},
  {"rejects oversized values instead of truncating", configRejectsOversizedValues},
};

static const TestSuite ConfigTestSuite = {
  .name      = "config",
  .cases     = CONFIG_TEST_CASES,
  .caseCount = sizeof(CONFIG_TEST_CASES) / sizeof(CONFIG_TEST_CASES[0]),
};
