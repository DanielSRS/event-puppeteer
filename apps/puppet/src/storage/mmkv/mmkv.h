#ifndef DSRS_MMKV_H_
#define DSRS_MMKV_H_

#include <MMKVBridge.h>

struct MmkvType {
  /**
   * Initialize the MMKV system with a root directory and log level.
   */
  void (*const initialize)(const char *rootPath, int logLevel);
  
  /**
   * Create a default MMKV instance.
   */
  MMKVHandle_t (*const createDefault)(void);
  
  /**
   * Encode a string value into the MMKV instance for a given key.
   */
  void (*const encodeString)(MMKVHandle_t handle, const char *key, const char *value);
  
  /**
   * Decode a string value from the MMKV instance for a given key.
   * The returned string must be freed using freeString().
   * Returns NULL if the key does not exist.
   */
  char *(*const decodeString)(MMKVHandle_t handle, const char *key);
  
  /**
   * Free a string value previously returned by decodeString().
   */
  void (*const freeString)(char *value);
};

extern const struct MmkvType MmkvI;

#ifdef DSRS_MMKV_IMPLEMENTATION
#include "mmkv.c"
#endif

#endif // DSRS_MMKV_H_
