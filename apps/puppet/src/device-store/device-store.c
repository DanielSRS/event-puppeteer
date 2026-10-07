#include "device-store.h"

#include <string.h>

#define DEVICE_STORE_DEVICE_ID_KEY    "device.id"
#define DEVICE_STORE_DEVICE_TOKEN_KEY "device.token"
#define DEVICE_STORE_FEED_KEY         "feed.events"

/**
 * Copy a stored string into a fixed buffer. Values that no longer fit (e.g.
 * written by a future version) are treated as absent rather than truncated,
 * since a truncated token would only be rejected by Puppeteer later.
 */
static bool deviceStoreLoadString(
  MMKVHandle_t handle, const char *key, char *destination, const size_t capacity
) {
  char *stored = MmkvI.decodeString(handle, key);
  if (stored == NULL) {
    return false;
  }
  const size_t length = strlen(stored);
  const bool   fits   = length > 0 && length < capacity;
  if (fits) {
    memcpy(destination, stored, length + 1);
  }
  MmkvI.freeString(stored);
  return fits;
}

static bool deviceStoreLoadCredentials(
  MMKVHandle_t handle, DeviceCredentials *credentials
) {
  return deviceStoreLoadString(
           handle,
           DEVICE_STORE_DEVICE_ID_KEY,
           credentials->deviceId,
           sizeof(credentials->deviceId)
         )
      && deviceStoreLoadString(
           handle,
           DEVICE_STORE_DEVICE_TOKEN_KEY,
           credentials->token,
           sizeof(credentials->token)
         );
}

static bool deviceStoreSaveCredentials(
  MMKVHandle_t handle, const DeviceCredentials *credentials
) {
  const bool saved =
    MmkvI.encodeString(handle, DEVICE_STORE_DEVICE_ID_KEY, credentials->deviceId)
    && MmkvI.encodeString(
      handle, DEVICE_STORE_DEVICE_TOKEN_KEY, credentials->token
    );
  MmkvI.sync(handle);
  return saved;
}

static void deviceStoreClearCredentials(MMKVHandle_t handle) {
  MmkvI.removeValue(handle, DEVICE_STORE_DEVICE_ID_KEY);
  MmkvI.removeValue(handle, DEVICE_STORE_DEVICE_TOKEN_KEY);
  MmkvI.sync(handle);
}

static bool deviceStoreSaveFeed(MMKVHandle_t handle, const char *feedJson) {
  return MmkvI.encodeString(handle, DEVICE_STORE_FEED_KEY, feedJson);
}

const struct DeviceStoreType DeviceStoreI = {
  .loadCredentials  = deviceStoreLoadCredentials,
  .saveCredentials  = deviceStoreSaveCredentials,
  .clearCredentials = deviceStoreClearCredentials,
  .saveFeed         = deviceStoreSaveFeed,
};
