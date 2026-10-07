/**
 * @file sha256.h
 * @brief Streaming SHA-256 (FIPS 180-4), allocation-free.
 *
 * Used to verify binaries downloaded by the `update` Command against the
 * digest supplied by Puppeteer. Implemented in-house to avoid linking a full
 * cryptography library for a single hash.
 *
 * ## Example
 *
 * ```c
 * Sha256Context context = Sha256I.create();
 * Sha256I.update(&context, data, dataLength);
 * uint8_t digest[SHA256_DIGEST_LENGTH];
 * Sha256I.finish(&context, digest);
 * ```
 */
#ifndef PUPPET_SHA256_H_
#define PUPPET_SHA256_H_

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** Size of a SHA-256 digest in bytes. */
#define SHA256_DIGEST_LENGTH ((size_t)32)

/** Size of a digest written as lowercase hexadecimal, plus terminator. */
#define SHA256_HEX_DIGEST_CAPACITY ((size_t)65)

/** SHA-256 processes its input in blocks of this many bytes. */
#define SHA256_BLOCK_LENGTH ((size_t)64)

/** Number of 32-bit words in the hash state. */
#define SHA256_STATE_WORDS ((size_t)8)

typedef struct {
  uint32_t state[SHA256_STATE_WORDS];

  /** Bytes of the current, incomplete block. */
  uint8_t block[SHA256_BLOCK_LENGTH];
  size_t  blockLength;

  /** Total bytes hashed so far. */
  uint64_t messageLength;
} Sha256Context;

struct Sha256Type {
  /** A context ready to hash a new message. */
  Sha256Context (*const create)(void);

  /** Feed `length` bytes of the message. May be called repeatedly. */
  void (*const update)(Sha256Context *context, const void *data, size_t length);

  /** Complete the hash and write `SHA256_DIGEST_LENGTH` bytes to `digest`. */
  void (*const finish)(Sha256Context *context, uint8_t *digest);

  /**
   * Parse a 64-character hexadecimal digest (either case) into `digest`.
   *
   * @return false when `text` is not exactly 64 hexadecimal characters.
   */
  bool (*const parseHexDigest)(const char *text, uint8_t *digest);
};

extern const struct Sha256Type Sha256I;

#ifdef PUPPET_SHA256_IMPLEMENTATION
#include "sha256.c"
#endif

#endif // PUPPET_SHA256_H_
