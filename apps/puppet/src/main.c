#define DSRS_MMKV_IMPLEMENTATION
#include "mmkv/mmkv.h"

#define DSRS_STATS_IMPLEMENTATION
#include "stats/stats.h"

#include <stdio.h>

int main(void) {
  printf("Hello, World!\n");

  // Initialize MMKV with root path and log level (4 = MMKVLogNone)
  MmkvI.initialize();

  // Create a default MMKV instance
  MMKVHandle_t mmkv = MmkvI.createDefault();

  // Test write and read
  MmkvI.encodeString(mmkv, "test_key", "Hello from MMKV!");

  char *value = MmkvI.decodeString(mmkv, "test_key");
  if (value) {
    printf("Read from MMKV: %s\n", value);
    MmkvI.freeString(value);
  }

  // Test Stats
  StatsSnapshot stats = StatsI.getSnapshot();
  printf("\n--- System Stats Snapshot ---\n");
  printf("OS: %s %s\n", stats.osName, stats.osVersion);
  printf("Kernel: %s\n", stats.kernelVersion);
  printf("Username: %s\n", stats.username);
  printf("IP Address: %s\n", stats.ip[0] ? stats.ip : "Unknown");
  printf("Uptime: %llu seconds\n", (unsigned long long)stats.uptime);
  printf("CPU Temp: %.1f C\n", stats.cpuTemperature);
  printf("CPU Usage: %.1f%%\n", stats.cpuUsage);
  printf("RAM Total: %llu MB\n", (unsigned long long)(stats.totalSystemMemory / 1024 / 1024));
  printf("RAM Used: %llu MB\n", (unsigned long long)(stats.usedSystemMemory / 1024 / 1024));
  printf("App Memory (RSS): %llu KB\n", (unsigned long long)(stats.appMemoryUsage / 1024));
  printf("Storage Total: %llu MB\n", (unsigned long long)(stats.storageTotal / 1024 / 1024));
  printf("Storage Used: %llu MB\n", (unsigned long long)(stats.storageUsed / 1024 / 1024));
  printf("-----------------------------\n");

  return 0;
}
