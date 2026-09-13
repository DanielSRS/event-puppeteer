#define DSRS_MMKV_IMPLEMENTATION
#include "mmkv/mmkv.h"

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

  return 0;
}
