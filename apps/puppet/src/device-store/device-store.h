/**
 * @file device-store.h
 * @brief Persistent, on-device state of a Puppet, backed by MMKV.
 *
 * Holds what must survive restarts and reboots:
 *
 * - **Credentials** issued on Enrollment. Losing them would make the Puppet
 *   connect again and appear as a brand-new pending Device, so writes are
 *   synced to disk immediately.
 * - **Event feed**: the last valid feed received from Puppeteer, stored as
 *   raw JSON so a display can render it even while offline.
 *
 * All functions take an MMKV handle created by `MmkvI.createDefault()` after
 * `MmkvI.initialize()`.
 */
#ifndef PUPPET_DEVICE_STORE_H_
#define PUPPET_DEVICE_STORE_H_

#include "mmkv/mmkv.h"
#include "protocol/protocol.h"

#include <stdbool.h>

struct DeviceStoreType {
  /**
   * Load stored credentials.
   *
   * @return true when complete credentials were found and copied into
   *         `credentials`; false otherwise (`credentials` is then unusable).
   */
  bool (*const loadCredentials)(
    MMKVHandle_t handle, DeviceCredentials *credentials
  );

  /** Persist credentials and sync them to disk. Returns false on failure. */
  bool (*const saveCredentials)(
    MMKVHandle_t handle, const DeviceCredentials *credentials
  );

  /** Forget the credentials (e.g. after Puppeteer revoked them). */
  void (*const clearCredentials)(MMKVHandle_t handle);

  /**
   * Replace the stored event feed. Only pass feeds already validated with
   * `ProtocolI.countFeedEvents`. Returns false on failure.
   */
  bool (*const saveFeed)(MMKVHandle_t handle, const char *feedJson);
};

extern const struct DeviceStoreType DeviceStoreI;

#ifdef PUPPET_DEVICE_STORE_IMPLEMENTATION
#include "device-store.c"
#endif

#endif // PUPPET_DEVICE_STORE_H_
