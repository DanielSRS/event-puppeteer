#include "mmkv.h"

/** MMKVLogNone: MMKV's own logging is noise on a kiosk's console. */
#define MMKV_LOG_LEVEL_NONE ((int32_t)4)

static void mmkvInitialize(const char *rootDirectory) {
  mmkv_initialize(rootDirectory, MMKV_LOG_LEVEL_NONE);
}

static void mmkvShutdown(void) { mmkv_on_exit(); }

static MMKVHandle_t mmkvCreateDefault(void) {
  MMKVConfig_t config = {0};
  return mmkv_default(config);
}

static bool
mmkvEncodeString(MMKVHandle_t handle, const char *key, const char *value) {
  return mmkv_encode_string(handle, key, value);
}

static char *mmkvDecodeString(MMKVHandle_t handle, const char *key) {
  return mmkv_decode_string(handle, key);
}

static void mmkvFreeString(char *value) { mmkv_free(value); }

static void mmkvRemoveValue(MMKVHandle_t handle, const char *key) {
  mmkv_remove_value(handle, key);
}

/** `true` requests MS_SYNC: block until the data is on disk. */
static void mmkvSync(MMKVHandle_t handle) { mmkv_sync(handle, true); }

const struct MmkvType MmkvI = {
  .initialize    = mmkvInitialize,
  .shutdown      = mmkvShutdown,
  .createDefault = mmkvCreateDefault,
  .encodeString  = mmkvEncodeString,
  .decodeString  = mmkvDecodeString,
  .freeString    = mmkvFreeString,
  .removeValue   = mmkvRemoveValue,
  .sync          = mmkvSync,
};
