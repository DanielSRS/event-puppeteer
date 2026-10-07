#ifndef DSRS_MMKV_H_
#define DSRS_MMKV_H_

#include <MMKVBridge.h>

struct MmkvType {
  /**
   * Initialize the MMKV system.
   *
   * @param rootDirectory  Directory holding all MMKV files. Created (with
   *                       parents) when missing. It must be persistent
   *                       storage: anything kept here is expected to survive
   *                       reboots.
   */
  void (*const initialize)(const char *rootDirectory);

  /**
   * Flush pending writes and release MMKV global resources. Call once at
   * program exit.
   */
  void (*const shutdown)(void);

  /**
   * Create a default MMKV instance.
   */
  MMKVHandle_t (*const createDefault)(void);

  /**
   * Encode a string value into the MMKV instance for a given key.
   * Returns false if the value could not be stored.
   */
  bool (*const encodeString)(
    MMKVHandle_t handle, const char *key, const char *value
  );

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

  /**
   * Remove the value stored under `key`, if any.
   */
  void (*const removeValue)(MMKVHandle_t handle, const char *key);

  /**
   * Synchronously persist pending writes to disk. Use after values whose
   * loss on power failure would be costly (e.g. Device credentials).
   */
  void (*const sync)(MMKVHandle_t handle);
};

extern const struct MmkvType MmkvI;

#ifdef DSRS_MMKV_IMPLEMENTATION
  #include "mmkv.c"
#endif

#endif // DSRS_MMKV_H_
