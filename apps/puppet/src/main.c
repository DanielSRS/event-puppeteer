#include <MMKVBridge.h>
#include <stdio.h>

int main(void) {
  printf("Hello, World!\n");

  // Initialize MMKV with root path and log level (4 = MMKVLogNone)
  mmkv_initialize("/tmp/mmkv", 4);

  // Create a default MMKV instance
  MMKVConfig_t config = {0};
  MMKVHandle_t mmkv   = mmkv_default(config);

  // Test write and read
  mmkv_encode_string(mmkv, "test_key", "Hello from MMKV!");

  char *value = mmkv_decode_string(mmkv, "test_key");
  if (value) {
    printf("Read from MMKV: %s\n", value);
    mmkv_free(value);
  }

  return 0;
}
