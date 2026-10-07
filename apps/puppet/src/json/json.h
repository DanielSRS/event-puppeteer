/**
 * @file json.h
 * @brief Allocation-free JSON tokenizer and writer.
 *
 * Puppet exchanges small JSON documents with Puppeteer. This module provides
 * the two halves needed for that without any heap usage:
 *
 * - **Reading**: `JsonI.parse` tokenizes a document into a caller-provided
 *   array of `JsonToken`s (in document order, parents before children).
 *   Tokens only reference byte ranges of the source text, so the text must
 *   outlive them. Helper functions navigate objects and arrays and copy
 *   values out into fixed-size buffers.
 * - **Writing**: `JsonWriterI` appends JSON into a caller-provided buffer,
 *   handling commas and string escaping. Overflow is sticky and reported once
 *   by `JsonWriterI.finish`.
 *
 * ## Token layout
 *
 * - An object's `childCount` is its number of keys.
 * - A key (string) token has `childCount == 1`: its value follows it.
 * - An array's `childCount` is its number of elements.
 * - Strings exclude their surrounding quotes; escapes are left as-is until
 *   `JsonI.copyString` decodes them.
 *
 * ## Example
 *
 * ```c
 * JsonToken tokens[32];
 * const JsonParseResult parsed = JsonI.parse(body, bodyLength, tokens, 32);
 * if (parsed.code != JSON_RESULT_OK) { return parsed.code; }
 *
 * const int32_t tokenIndex =
 *   JsonI.findMember(body, tokens, parsed.tokenCount, 0, "token");
 * char token[96];
 * JsonI.copyString(body, tokens, parsed.tokenCount, tokenIndex, token, 96);
 * ```
 */
#ifndef PUPPET_JSON_H_
#define PUPPET_JSON_H_

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/** Returned by lookup functions when the requested token does not exist. */
#define JSON_NOT_FOUND ((int32_t)-1)

/**
 * Result codes of this module. Each failure path owns a distinct value in the
 * 1000–1999 range so a reported code pinpoints its origin.
 */
typedef enum {
  JSON_RESULT_OK = 0,

  /** More tokens were needed than the caller-provided capacity. */
  JSON_ERROR_TOKEN_CAPACITY_EXCEEDED = 1001,
  /** A closing bracket did not match the innermost open container. */
  JSON_ERROR_MISMATCHED_BRACKET = 1002,
  /** A closing bracket appeared with no container open. */
  JSON_ERROR_UNEXPECTED_CLOSING_BRACKET = 1003,
  /** The input ended inside a string. */
  JSON_ERROR_UNTERMINATED_STRING = 1004,
  /** A backslash was followed by an unknown escape character. */
  JSON_ERROR_INVALID_ESCAPE = 1005,
  /** A raw control character appeared inside a string. */
  JSON_ERROR_CONTROL_CHARACTER_IN_STRING = 1006,
  /** A character that cannot start any JSON value was found. */
  JSON_ERROR_UNEXPECTED_CHARACTER = 1007,
  /** The input ended while a container was still open. */
  JSON_ERROR_UNCLOSED_CONTAINER = 1008,
  /** The input contained no value at all. */
  JSON_ERROR_EMPTY_DOCUMENT = 1009,

  /** The token index passed to an accessor is out of range. */
  JSON_ERROR_INVALID_TOKEN_INDEX = 1010,
  /** The token exists but is not of the requested kind. */
  JSON_ERROR_WRONG_TOKEN_KIND = 1011,
  /** The decoded string does not fit the destination buffer. */
  JSON_ERROR_DESTINATION_TOO_SMALL = 1012,
  /** A `\u` escape had fewer than four hexadecimal digits. */
  JSON_ERROR_INVALID_UNICODE_ESCAPE = 1013,
  /** A primitive is not a valid number. */
  JSON_ERROR_INVALID_NUMBER = 1014,
  /** A primitive is not `true` or `false`. */
  JSON_ERROR_INVALID_BOOLEAN = 1015,

  /** The writer ran out of buffer space. */
  JSON_ERROR_WRITER_OVERFLOW = 1016,
} JsonResultCode;

typedef enum {
  JSON_TOKEN_OBJECT = 1,
  JSON_TOKEN_ARRAY,
  JSON_TOKEN_STRING,

  /** A number, `true`, `false` or `null`. */
  JSON_TOKEN_PRIMITIVE,
} JsonTokenKind;

typedef struct {
  JsonTokenKind kind;

  /** Byte offset of the first character (after the quote for strings). */
  uint32_t start;

  /** Byte offset one past the last character (before the closing quote). */
  uint32_t end;

  /** Number of direct children (see "Token layout" above). */
  uint32_t childCount;

  /** Index of the enclosing token, or `JSON_NOT_FOUND` for the root. */
  int32_t parent;
} JsonToken;

typedef struct {
  JsonResultCode code;

  /** Number of tokens written. Valid only when `code == JSON_RESULT_OK`. */
  uint32_t tokenCount;
} JsonParseResult;

struct JsonType {
  /**
   * Tokenize `text` into `tokens`.
   *
   * @param text           JSON text. Need not be null-terminated.
   * @param textLength     Number of bytes of `text` to parse.
   * @param tokens         Destination array.
   * @param tokenCapacity  Number of elements available in `tokens`.
   * @return The token count on success, or the first error encountered.
   */
  JsonParseResult (*const parse)(
    const char *text,
    size_t      textLength,
    JsonToken  *tokens,
    uint32_t    tokenCapacity
  );

  /**
   * Index of the token that follows the whole subtree rooted at
   * `tokenIndex` (i.e. its next sibling, or `tokenCount` at the end).
   */
  uint32_t (*const skip)(
    const JsonToken *tokens, uint32_t tokenCount, uint32_t tokenIndex
  );

  /**
   * Find the value of `key` in the object at `objectIndex`.
   *
   * @return The value's token index, or `JSON_NOT_FOUND` when the key is
   *         absent or `objectIndex` is not an object.
   */
  int32_t (*const findMember)(
    const char      *text,
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          objectIndex,
    const char      *key
  );

  /**
   * Find the `position`-th element (zero-based) of the array at
   * `arrayIndex`.
   *
   * @return The element's token index, or `JSON_NOT_FOUND`.
   */
  int32_t (*const arrayElement)(
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          arrayIndex,
    uint32_t         position
  );

  /**
   * Whether the string or primitive token's raw text equals `literal`
   * exactly. Escapes are not decoded, so use it for plain ASCII values only.
   */
  bool (*const equals)(
    const char      *text,
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          tokenIndex,
    const char      *literal
  );

  /**
   * Decode the string token at `tokenIndex` into `destination` as a
   * null-terminated UTF-8 string.
   *
   * @return `JSON_RESULT_OK`, or an error when the token is missing, not a
   *         string, malformed, or longer than `destinationCapacity - 1`.
   */
  JsonResultCode (*const copyString)(
    const char      *text,
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          tokenIndex,
    char            *destination,
    size_t           destinationCapacity
  );

  /** Read a boolean primitive into `value`. */
  JsonResultCode (*const readBoolean)(
    const char      *text,
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          tokenIndex,
    bool            *value
  );

  /** Read an integral number primitive into `value`. */
  JsonResultCode (*const readInteger)(
    const char      *text,
    const JsonToken *tokens,
    uint32_t         tokenCount,
    int32_t          tokenIndex,
    int64_t         *value
  );
};

extern const struct JsonType JsonI;

/**
 * Appends JSON into a fixed buffer. Create with `JsonWriterI.create`; never
 * modify the fields directly.
 */
typedef struct {
  char  *buffer;
  size_t capacity;
  size_t length;

  /** Whether the next value or key must be preceded by a comma. */
  bool needsSeparator;

  /** Set once any write did not fit; all later writes are ignored. */
  bool overflowed;
} JsonWriter;

struct JsonWriterType {
  /**
   * Start writing into `buffer`. The buffer is always kept null-terminated,
   * so `capacity` must be at least 1.
   */
  JsonWriter (*const create)(char *buffer, size_t capacity);

  void (*const beginObject)(JsonWriter *writer);
  void (*const endObject)(JsonWriter *writer);
  void (*const beginArray)(JsonWriter *writer);
  void (*const endArray)(JsonWriter *writer);

  /** Write an object key. The next call must write its value. */
  void (*const key)(JsonWriter *writer, const char *name);

  /** Write an escaped string value. */
  void (*const string)(JsonWriter *writer, const char *value);

  void (*const integer)(JsonWriter *writer, int64_t value);
  void (*const unsignedInteger)(JsonWriter *writer, uint64_t value);

  /** Write a number with up to two decimal places. */
  void (*const decimal)(JsonWriter *writer, double value);

  void (*const boolean)(JsonWriter *writer, bool value);

  /**
   * Finish writing.
   *
   * @return `JSON_RESULT_OK`, or `JSON_ERROR_WRITER_OVERFLOW` when the
   *         document did not fit (the buffer then holds a truncated prefix).
   */
  JsonResultCode (*const finish)(const JsonWriter *writer);
};

extern const struct JsonWriterType JsonWriterI;

#ifdef PUPPET_JSON_IMPLEMENTATION
#include "json.c"
#endif

#endif // PUPPET_JSON_H_
