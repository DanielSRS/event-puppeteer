#include "stats.h"

#include <arpa/inet.h>
#include <ifaddrs.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/statvfs.h>
#include <sys/sysinfo.h>
#include <sys/utsname.h>
#include <unistd.h>

static StatsSnapshot getSnapshot(void) {
  StatsSnapshot s = {0};

  // 1. Sysinfo (Memory & Uptime)
  struct sysinfo info;
  if (sysinfo(&info) == 0) {
    s.totalSystemMemory = (uint64_t)info.totalram * info.mem_unit;
    // Approximation for used memory (total - free - buffer - shared is more
    // accurate, but this provides a baseline).
    s.usedSystemMemory = (uint64_t)(info.totalram - info.freeram) * info.mem_unit;
    s.uptime = (uint64_t)info.uptime;
  }

  // 2. Kernel & OS Basics
  struct utsname uts;
  if (uname(&uts) == 0) {
    strncpy(s.kernelVersion, uts.release, sizeof(s.kernelVersion) - 1);
    strncpy(s.osName, uts.sysname, sizeof(s.osName) - 1); // Fallback
  }

  // 3. /etc/os-release (Detailed OS Name & Version)
  FILE *osRel = fopen("/etc/os-release", "r");
  if (osRel) {
    char line[256];
    while (fgets(line, sizeof(line), osRel)) {
      if (strncmp(line, "NAME=", 5) == 0) {
        char *val = line + 5;
        if (val[0] == '"') {
          sscanf(val, "\"%63[^\"]\"", s.osName);
        } else {
          sscanf(val, "%63s", s.osName);
        }
      } else if (strncmp(line, "VERSION=", 8) == 0) {
        char *val = line + 8;
        if (val[0] == '"') {
          sscanf(val, "\"%127[^\"]\"", s.osVersion);
        } else {
          sscanf(val, "%127s", s.osVersion);
        }
      }
    }
    fclose(osRel);
  }

  // 4. Username
  struct passwd *pw = getpwuid(getuid());
  if (pw) {
    strncpy(s.username, pw->pw_name, sizeof(s.username) - 1);
  }

  // 5. IP Address (First non-loopback IPv4)
  struct ifaddrs *ifaddr, *ifa;
  if (getifaddrs(&ifaddr) == 0) {
    for (ifa = ifaddr; ifa != NULL; ifa = ifa->ifa_next) {
      if (ifa->ifa_addr == NULL) {
        continue;
      }
      if (ifa->ifa_addr->sa_family == AF_INET) {
        if (strcmp(ifa->ifa_name, "lo") != 0) {
          struct sockaddr_in *pAddr = (struct sockaddr_in *)(void *)ifa->ifa_addr;
          inet_ntop(AF_INET, &pAddr->sin_addr, s.ip, sizeof(s.ip));
          break;
        }
      }
    }
    freeifaddrs(ifaddr);
  }

  // 6. Storage (Root partition)
  struct statvfs vfs;
  if (statvfs("/", &vfs) == 0) {
    s.storageTotal = (uint64_t)vfs.f_blocks * (uint64_t)vfs.f_frsize;
    s.storageUsed = (uint64_t)(vfs.f_blocks - vfs.f_bfree) * (uint64_t)vfs.f_frsize;
  }

  // 7. CPU Temperature (Linux thermal zone)
  FILE *tempFile = fopen("/sys/class/thermal/thermal_zone0/temp", "r");
  if (tempFile) {
    int millidegrees = 0;
    if (fscanf(tempFile, "%d", &millidegrees) == 1) {
      s.cpuTemperature = (float)millidegrees / 1000.0f;
    }
    fclose(tempFile);
  }

  // 8. App Memory Usage (Resident Set Size)
  FILE *statm = fopen("/proc/self/statm", "r");
  if (statm) {
    unsigned long long size = 0;
    unsigned long long rss = 0;
    if (fscanf(statm, "%llu %llu", &size, &rss) == 2) {
      s.appMemoryUsage = (uint64_t)rss * (uint64_t)sysconf(_SC_PAGESIZE);
    }
    fclose(statm);
  }

  // 9. CPU Usage
  static uint64_t prevIdle = 0;
  static uint64_t prevTotal = 0;
  
  uint64_t currentIdle = 0, currentTotal = 0;
  
  // Helper lambda-style block to read CPU ticks
  #define READ_CPU_TICKS(idleOut, totalOut, successOut) do { \
    FILE *stat = fopen("/proc/stat", "r"); \
    successOut = 0; \
    if (stat) { \
      char cpu[16]; \
      unsigned long long user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0; \
      if (fscanf(stat, "%15s %llu %llu %llu %llu %llu %llu %llu %llu", cpu, &user, &nice, &system, &idle, &iowait, &irq, &softirq, &steal) == 9) { \
        idleOut = idle + iowait; \
        totalOut = idleOut + user + nice + system + irq + softirq + steal; \
        successOut = 1; \
      } \
      fclose(stat); \
    } \
  } while(0)

  int readSuccess = 0;
  READ_CPU_TICKS(currentIdle, currentTotal, readSuccess);

  if (readSuccess) {
    if (prevTotal == 0) {
      // Very first call. Average since boot is useless for real-time monitoring.
      // We block for 100ms to get a genuine instantaneous CPU usage window.
      usleep(100000);
      prevIdle = currentIdle;
      prevTotal = currentTotal;
      READ_CPU_TICKS(currentIdle, currentTotal, readSuccess);
    }

    if (readSuccess && prevTotal != 0) {
      uint64_t totalDiff = currentTotal - prevTotal;
      uint64_t idleDiff = currentIdle - prevIdle;
      if (totalDiff > 0) {
        s.cpuUsage = (float)(totalDiff - idleDiff) / (float)totalDiff * 100.0f;
      }
    }
    prevIdle = currentIdle;
    prevTotal = currentTotal;
  }

  return s;
}

const struct StatsType StatsI = {
  .getSnapshot = getSnapshot
};
