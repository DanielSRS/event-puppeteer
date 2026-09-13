#ifndef DSRS_STATS_H_
#define DSRS_STATS_H_

#include <stdint.h>

/**
 * Pure data struct containing a snapshot of the OS system statistics.
 */
typedef struct {
  uint64_t totalSystemMemory; // Total system memory in bytes
  uint64_t usedSystemMemory;  // Used system memory in bytes
  uint64_t appMemoryUsage;    // Memory used by this process (RSS) in bytes
  uint64_t uptime;            // System uptime in seconds
  float cpuTemperature;       // CPU temperature in degrees Celsius
  float cpuUsage;             // CPU utilization percentage (0.0 to 100.0)
  uint64_t storageTotal;      // Total storage capacity of root mount in bytes
  uint64_t storageUsed;       // Used storage of root mount in bytes
  char ip[64];                // Primary IPv4 address
  char osName[64];            // OS Name (e.g. Debian GNU/Linux)
  char osVersion[128];        // OS Version (e.g. 11 (bullseye))
  char kernelVersion[64];     // Kernel release (e.g. 5.10.x)
  char username[64];          // Current executing username
} StatsSnapshot;

struct StatsType {
  /**
   * Fetches a complete snapshot of the current system statistics.
   * 
   * Note on cpuUsage: CPU usage is a delta measurement. The very first time
   * this function is called, cpuUsage will be 0.0. Subsequent calls will return
   * the average CPU usage percentage since the last call.
   */
  StatsSnapshot (*const getSnapshot)(void);
};

extern const struct StatsType StatsI;

#ifdef DSRS_STATS_IMPLEMENTATION
#include "stats.c"
#endif

#endif // DSRS_STATS_H_
