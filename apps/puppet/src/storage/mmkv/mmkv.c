#include "mmkv.h"

static void initialize(const char *rootPath, int logLevel) {
  mmkv_initialize(rootPath, logLevel);
}

static MMKVHandle_t createDefault(void) {
  MMKVConfig_t config = {0};
  return mmkv_default(config);
}

static void encodeString(MMKVHandle_t handle, const char *key, const char *value) {
  mmkv_encode_string(handle, key, value);
}

static char *decodeString(MMKVHandle_t handle, const char *key) {
  return mmkv_decode_string(handle, key);
}

static void freeString(char *value) {
  mmkv_free(value);
}

const struct MmkvType MmkvI = {
    .initialize = initialize,
    .createDefault = createDefault,
    .encodeString = encodeString,
    .decodeString = decodeString,
    .freeString = freeString
};
