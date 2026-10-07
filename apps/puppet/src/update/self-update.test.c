#include "testing/testing.h"
#include "update/self-update.h"

#include <string.h>

/** e_ident bytes: magic, ELFCLASS32, little endian, version 1. */
#define SELF_UPDATE_TEST_ARM32_IDENTITY 0x7f, 'E', 'L', 'F', 1, 1, 1

/** e_machine values (little endian) from the ELF specification. */
#define SELF_UPDATE_TEST_MACHINE_ARM    40, 0
#define SELF_UPDATE_TEST_MACHINE_X86_64 62, 0

/** Bytes between e_ident's version and e_machine that are not compared;
 *  e_type (offset 16) differs between PIE and non-PIE builds. */
#define SELF_UPDATE_TEST_IGNORED_BYTES 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0

static const uint8_t SELF_UPDATE_TEST_ARM32_HEADER[SELF_UPDATE_ELF_HEADER_LENGTH] = {
  SELF_UPDATE_TEST_ARM32_IDENTITY,
  SELF_UPDATE_TEST_IGNORED_BYTES,
  SELF_UPDATE_TEST_MACHINE_ARM,
};

static void selfUpdateAcceptsSameArchitecture(TestContext *context) {
  uint8_t candidate[SELF_UPDATE_ELF_HEADER_LENGTH];
  memcpy(candidate, SELF_UPDATE_TEST_ARM32_HEADER, sizeof(candidate));
  candidate[16] = 2; // ET_EXEC where the running binary is ET_DYN

  EXPECT(
    context,
    SelfUpdateI.checkCompatibility(candidate, SELF_UPDATE_TEST_ARM32_HEADER)
      == SELF_UPDATE_RESULT_OK
  );
}

static void selfUpdateRejectsOtherMachine(TestContext *context) {
  const uint8_t candidate[SELF_UPDATE_ELF_HEADER_LENGTH] = {
    SELF_UPDATE_TEST_ARM32_IDENTITY,
    SELF_UPDATE_TEST_IGNORED_BYTES,
    SELF_UPDATE_TEST_MACHINE_X86_64,
  };

  EXPECT(
    context,
    SelfUpdateI.checkCompatibility(candidate, SELF_UPDATE_TEST_ARM32_HEADER)
      == SELF_UPDATE_ERROR_ARCHITECTURE_MISMATCH
  );
}

static void selfUpdateRejectsOtherWordSize(TestContext *context) {
  uint8_t candidate[SELF_UPDATE_ELF_HEADER_LENGTH];
  memcpy(candidate, SELF_UPDATE_TEST_ARM32_HEADER, sizeof(candidate));
  candidate[4] = 2; // ELFCLASS64

  EXPECT(
    context,
    SelfUpdateI.checkCompatibility(candidate, SELF_UPDATE_TEST_ARM32_HEADER)
      == SELF_UPDATE_ERROR_ARCHITECTURE_MISMATCH
  );
}

static void selfUpdateRejectsNonElfFiles(TestContext *context) {
  uint8_t candidate[SELF_UPDATE_ELF_HEADER_LENGTH];
  memcpy(candidate, "<html><body>404 Not", sizeof(candidate));

  EXPECT(
    context,
    SelfUpdateI.checkCompatibility(candidate, SELF_UPDATE_TEST_ARM32_HEADER)
      == SELF_UPDATE_ERROR_NOT_AN_EXECUTABLE
  );
}

static const TestCase SELF_UPDATE_TEST_CASES[] = {
  {"accepts binaries for the same architecture", selfUpdateAcceptsSameArchitecture},
  {"rejects binaries for another machine", selfUpdateRejectsOtherMachine},
  {"rejects binaries with another word size", selfUpdateRejectsOtherWordSize},
  {"rejects files that are not ELF binaries", selfUpdateRejectsNonElfFiles},
};

static const TestSuite SelfUpdateTestSuite = {
  .name      = "self-update",
  .cases     = SELF_UPDATE_TEST_CASES,
  .caseCount = sizeof(SELF_UPDATE_TEST_CASES) / sizeof(SELF_UPDATE_TEST_CASES[0]),
};
