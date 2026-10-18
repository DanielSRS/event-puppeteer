#include "crypto/sha256.h"
#include "testing/testing.h"

#include <string.h>

/** Large enough for the multi-block "one million a" vector in chunks. */
#define SHA256_TEST_CHUNK_LENGTH ((size_t)1000)
#define SHA256_TEST_CHUNK_COUNT  ((size_t)1000)

static bool sha256TestMatches(
  const uint8_t *digest, const char *expectedHexDigest
) {
  uint8_t expected[SHA256_DIGEST_LENGTH];
  return Sha256I.parseHexDigest(expectedHexDigest, expected)
      && memcmp(digest, expected, SHA256_DIGEST_LENGTH) == 0;
}

static bool sha256TestHashOf(const char *message, const char *expectedHexDigest) {
  Sha256Context context = Sha256I.create();
  Sha256I.update(&context, message, strlen(message));
  uint8_t digest[SHA256_DIGEST_LENGTH];
  Sha256I.finish(&context, digest);
  return sha256TestMatches(digest, expectedHexDigest);
}

/** Test vectors from NIST's "SHA-256 example" document. */
static void sha256MatchesNistVectors(TestContext *context) {
  EXPECT(
    context,
    sha256TestHashOf(
      "", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  );
  EXPECT(
    context,
    sha256TestHashOf(
      "abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  );
  /** 56 bytes: the length field no longer fits, forcing an extra block. */
  EXPECT(
    context,
    sha256TestHashOf(
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    )
  );
}

static void sha256HashesAcrossChunks(TestContext *context) {
  char chunk[SHA256_TEST_CHUNK_LENGTH];
  memset(chunk, 'a', sizeof(chunk)); // deliberately filled test input

  Sha256Context hashContext = Sha256I.create();
  for (size_t index = 0; index < SHA256_TEST_CHUNK_COUNT; index++) {
    Sha256I.update(&hashContext, chunk, sizeof(chunk));
  }
  uint8_t digest[SHA256_DIGEST_LENGTH];
  Sha256I.finish(&hashContext, digest);

  EXPECT(
    context,
    sha256TestMatches(
      digest, "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    )
  );
}

static void sha256ParsesHexDigests(TestContext *context) {
  uint8_t digest[SHA256_DIGEST_LENGTH];

  EXPECT(
    context,
    Sha256I.parseHexDigest(
      "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", digest
    )
  );
  EXPECT(context, digest[0] == 0xba && digest[31] == 0xad);
  EXPECT(context, !Sha256I.parseHexDigest("ba7816bf", digest));
  EXPECT(
    context,
    !Sha256I.parseHexDigest(
      "zz7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", digest
    )
  );
}

static void sha256FormatsHexDigests(TestContext *context) {
  const char *const expected =
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  uint8_t digest[SHA256_DIGEST_LENGTH];
  char    text[SHA256_HEX_DIGEST_CAPACITY];

  EXPECT(context, Sha256I.parseHexDigest(expected, digest));
  Sha256I.formatHexDigest(digest, text);
  EXPECT(context, strcmp(text, expected) == 0);
}

static const TestCase SHA256_TEST_CASES[] = {
  {"matches NIST test vectors", sha256MatchesNistVectors},
  {"hashes one million bytes across chunks", sha256HashesAcrossChunks},
  {"parses hexadecimal digests", sha256ParsesHexDigests},
  {"formats digests as lowercase hexadecimal", sha256FormatsHexDigests},
};

static const TestSuite Sha256TestSuite = {
  .name      = "sha256",
  .cases     = SHA256_TEST_CASES,
  .caseCount = sizeof(SHA256_TEST_CASES) / sizeof(SHA256_TEST_CASES[0]),
};
