#include "sha256.h"

#include <string.h>

/** Offset of the 64-bit message length inside the final padded block. */
#define SHA256_LENGTH_FIELD_OFFSET (SHA256_BLOCK_LENGTH - sizeof(uint64_t))

/** Number of message schedule words per block. */
#define SHA256_SCHEDULE_WORDS ((size_t)64)

/** The single bit appended after the message, as the first padding byte. */
#define SHA256_PADDING_MARKER ((uint8_t)0x80)

#define SHA256_BITS_PER_BYTE ((uint64_t)8)

/** Initial hash value: fractional parts of the square roots of the first
 *  eight primes (FIPS 180-4, section 5.3.3). */
static const uint32_t SHA256_INITIAL_STATE[SHA256_STATE_WORDS] = {
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
};

/** Round constants: fractional parts of the cube roots of the first 64
 *  primes (FIPS 180-4, section 4.2.2). */
static const uint32_t SHA256_ROUND_CONSTANTS[SHA256_SCHEDULE_WORDS] = {
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

static inline uint32_t sha256RotateRight(const uint32_t value, const uint32_t count) {
  return (value >> count) | (value << (32 - count));
}

static uint32_t sha256ReadBigEndian(const uint8_t *bytes) {
  return ((uint32_t)bytes[0] << 24) | ((uint32_t)bytes[1] << 16)
       | ((uint32_t)bytes[2] << 8) | (uint32_t)bytes[3];
}

static void sha256WriteBigEndian(const uint32_t value, uint8_t *bytes) {
  bytes[0] = (uint8_t)(value >> 24);
  bytes[1] = (uint8_t)(value >> 16);
  bytes[2] = (uint8_t)(value >> 8);
  bytes[3] = (uint8_t)value;
}

static void sha256ProcessBlock(uint32_t *state, const uint8_t *block) {
  uint32_t schedule[SHA256_SCHEDULE_WORDS];
  for (size_t index = 0; index < 16; index++) {
    schedule[index] = sha256ReadBigEndian(block + index * 4);
  }
  for (size_t index = 16; index < SHA256_SCHEDULE_WORDS; index++) {
    const uint32_t previous15 = schedule[index - 15];
    const uint32_t previous2  = schedule[index - 2];
    const uint32_t sigma0     = sha256RotateRight(previous15, 7)
                          ^ sha256RotateRight(previous15, 18) ^ (previous15 >> 3);
    const uint32_t sigma1 = sha256RotateRight(previous2, 17)
                          ^ sha256RotateRight(previous2, 19) ^ (previous2 >> 10);
    schedule[index] = schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1;
  }

  /** Working variables keep FIPS 180-4's single-letter names so the round
   *  can be checked line by line against the specification. */
  uint32_t a = state[0];
  uint32_t b = state[1];
  uint32_t c = state[2];
  uint32_t d = state[3];
  uint32_t e = state[4];
  uint32_t f = state[5];
  uint32_t g = state[6];
  uint32_t h = state[7];
  for (size_t index = 0; index < SHA256_SCHEDULE_WORDS; index++) {
    const uint32_t sum1 = sha256RotateRight(e, 6) ^ sha256RotateRight(e, 11)
                        ^ sha256RotateRight(e, 25);
    const uint32_t choice = (e & f) ^ (~e & g);
    const uint32_t temporary1 =
      h + sum1 + choice + SHA256_ROUND_CONSTANTS[index] + schedule[index];
    const uint32_t sum0 = sha256RotateRight(a, 2) ^ sha256RotateRight(a, 13)
                        ^ sha256RotateRight(a, 22);
    const uint32_t majority   = (a & b) ^ (a & c) ^ (b & c);
    const uint32_t temporary2 = sum0 + majority;
    h = g;
    g = f;
    f = e;
    e = d + temporary1;
    d = c;
    c = b;
    b = a;
    a = temporary1 + temporary2;
  }
  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

static Sha256Context sha256Create(void) {
  Sha256Context context = {
    .blockLength   = 0,
    .messageLength = 0,
  };
  memcpy(context.state, SHA256_INITIAL_STATE, sizeof(context.state));
  return context;
}

static void sha256Update(
  Sha256Context *context, const void *data, const size_t length
) {
  const uint8_t *bytes = (const uint8_t *)data;
  context->messageLength += length;

  size_t consumed = 0;
  while (consumed < length) {
    const size_t space     = SHA256_BLOCK_LENGTH - context->blockLength;
    const size_t remaining = length - consumed;
    const size_t chunk     = remaining < space ? remaining : space;
    memcpy(context->block + context->blockLength, bytes + consumed, chunk);
    context->blockLength += chunk;
    consumed += chunk;
    if (context->blockLength == SHA256_BLOCK_LENGTH) {
      sha256ProcessBlock(context->state, context->block);
      context->blockLength = 0;
    }
  }
}

static void sha256Finish(Sha256Context *context, uint8_t *digest) {
  const uint64_t messageBits = context->messageLength * SHA256_BITS_PER_BYTE;

  context->block[context->blockLength] = SHA256_PADDING_MARKER;
  context->blockLength++;
  /** The length field must fit after the marker; otherwise pad this block
   *  out and place it in a fresh one. */
  if (context->blockLength > SHA256_LENGTH_FIELD_OFFSET) {
    memset(
      context->block + context->blockLength,
      0,
      SHA256_BLOCK_LENGTH - context->blockLength
    );
    sha256ProcessBlock(context->state, context->block);
    context->blockLength = 0;
  }
  memset(
    context->block + context->blockLength,
    0,
    SHA256_LENGTH_FIELD_OFFSET - context->blockLength
  );
  sha256WriteBigEndian(
    (uint32_t)(messageBits >> 32), context->block + SHA256_LENGTH_FIELD_OFFSET
  );
  sha256WriteBigEndian(
    (uint32_t)messageBits, context->block + SHA256_LENGTH_FIELD_OFFSET + 4
  );
  sha256ProcessBlock(context->state, context->block);

  for (size_t index = 0; index < SHA256_STATE_WORDS; index++) {
    sha256WriteBigEndian(context->state[index], digest + index * 4);
  }
}

static int32_t sha256HexValue(const char character) {
  if (character >= '0' && character <= '9') {
    return character - '0';
  }
  if (character >= 'a' && character <= 'f') {
    return character - 'a' + 10;
  }
  if (character >= 'A' && character <= 'F') {
    return character - 'A' + 10;
  }
  return -1;
}

static bool sha256ParseHexDigest(const char *text, uint8_t *digest) {
  if (strlen(text) != SHA256_HEX_DIGEST_CAPACITY - 1) {
    return false;
  }
  for (size_t index = 0; index < SHA256_DIGEST_LENGTH; index++) {
    const int32_t high = sha256HexValue(text[index * 2]);
    const int32_t low  = sha256HexValue(text[index * 2 + 1]);
    if (high < 0 || low < 0) {
      return false;
    }
    digest[index] = (uint8_t)((high << 4) | low);
  }
  return true;
}

const struct Sha256Type Sha256I = {
  .create         = sha256Create,
  .update         = sha256Update,
  .finish         = sha256Finish,
  .parseHexDigest = sha256ParseHexDigest,
};
