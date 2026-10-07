#include "json.h"

#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/** Marks a container token whose closing bracket has not been seen yet. */
#define JSON_OPEN_CONTAINER_END UINT32_MAX

/** Enough for any 64-bit integer plus sign and terminator. */
#define JSON_NUMBER_TEXT_CAPACITY ((size_t)32)

/** Number of hexadecimal digits in a `\u` escape. */
#define JSON_UNICODE_ESCAPE_DIGITS ((uint32_t)4)

/** UTF-16 surrogate ranges, needed to decode characters outside the BMP. */
#define JSON_HIGH_SURROGATE_FIRST ((uint32_t)0xD800)
#define JSON_HIGH_SURROGATE_LAST  ((uint32_t)0xDBFF)
#define JSON_LOW_SURROGATE_FIRST  ((uint32_t)0xDC00)
#define JSON_LOW_SURROGATE_LAST   ((uint32_t)0xDFFF)
#define JSON_SUPPLEMENTARY_PLANE_OFFSET ((uint32_t)0x10000)

/** Characters below this value must be escaped inside JSON strings. */
#define JSON_FIRST_PRINTABLE_CHARACTER ((unsigned char)0x20)

typedef struct {
  JsonToken *tokens;
  uint32_t   capacity;
  uint32_t   count;

  /** Token that new tokens become children of (`JSON_NOT_FOUND` at root). */
  int32_t superior;
} JsonParserState;

static bool jsonIsContainer(const JsonTokenKind kind) {
  return kind == JSON_TOKEN_OBJECT || kind == JSON_TOKEN_ARRAY;
}

static bool jsonIsWhitespace(const char character) {
  return character == ' ' || character == '\t' || character == '\n'
      || character == '\r';
}

static bool jsonIsPrimitiveDelimiter(const char character) {
  return jsonIsWhitespace(character) || character == ',' || character == ']'
      || character == '}' || character == ':';
}

static bool jsonIsPrimitiveStart(const char character) {
  return character == '-' || (character >= '0' && character <= '9')
      || character == 't' || character == 'f' || character == 'n';
}

static int32_t jsonHexadecimalValue(const char character) {
  if (character >= '0' && character <= '9') {
    return character - '0';
  }
  if (character >= 'a' && character <= 'f') {
    return character - 'a' + 10;
  }
  if (character >= 'A' && character <= 'F') {
    return character - 'A' + 10;
  }
  return JSON_NOT_FOUND;
}

static JsonResultCode jsonAppendToken(
  JsonParserState    *state,
  const JsonTokenKind kind,
  const uint32_t      start,
  const uint32_t      end
) {
  if (state->count >= state->capacity) {
    return JSON_ERROR_TOKEN_CAPACITY_EXCEEDED;
  }
  state->tokens[state->count] = (JsonToken){
    .kind       = kind,
    .start      = start,
    .end        = end,
    .childCount = 0,
    .parent     = state->superior,
  };
  if (state->superior != JSON_NOT_FOUND) {
    state->tokens[state->superior].childCount++;
  }
  state->count++;
  return JSON_RESULT_OK;
}

static JsonResultCode jsonOpenContainer(
  JsonParserState    *state,
  const JsonTokenKind kind,
  const uint32_t      position
) {
  const JsonResultCode code =
    jsonAppendToken(state, kind, position, JSON_OPEN_CONTAINER_END);
  if (code != JSON_RESULT_OK) {
    return code;
  }
  state->superior = (int32_t)(state->count - 1);
  return JSON_RESULT_OK;
}

static JsonResultCode jsonCloseContainer(
  JsonParserState    *state,
  const JsonTokenKind kind,
  const uint32_t      position
) {
  /** The innermost open container is always an ancestor of the most
   *  recently added token, so walking parents from there finds it. */
  int32_t index = (int32_t)state->count - 1;
  while (index != JSON_NOT_FOUND) {
    JsonToken *token = &state->tokens[index];
    if (jsonIsContainer(token->kind)
        && token->end == JSON_OPEN_CONTAINER_END) {
      if (token->kind != kind) {
        return JSON_ERROR_MISMATCHED_BRACKET;
      }
      token->end      = position + 1;
      state->superior = token->parent;
      return JSON_RESULT_OK;
    }
    index = token->parent;
  }
  return JSON_ERROR_UNEXPECTED_CLOSING_BRACKET;
}

/** Scans the string opening at `*position`, leaving it on the closing quote. */
static JsonResultCode jsonParseString(
  JsonParserState *state,
  const char      *text,
  const uint32_t   textLength,
  uint32_t        *position
) {
  const uint32_t start = *position + 1;
  for (uint32_t cursor = start; cursor < textLength; cursor++) {
    const char character = text[cursor];
    if (character == '"') {
      *position = cursor;
      return jsonAppendToken(state, JSON_TOKEN_STRING, start, cursor);
    }
    if ((unsigned char)character < JSON_FIRST_PRINTABLE_CHARACTER) {
      return JSON_ERROR_CONTROL_CHARACTER_IN_STRING;
    }
    if (character != '\\') {
      continue;
    }
    cursor++;
    if (cursor >= textLength) {
      return JSON_ERROR_UNTERMINATED_STRING;
    }
    if (text[cursor] == 'u') {
      for (uint32_t digit = 0; digit < JSON_UNICODE_ESCAPE_DIGITS; digit++) {
        cursor++;
        if (cursor >= textLength
            || jsonHexadecimalValue(text[cursor]) == JSON_NOT_FOUND) {
          return JSON_ERROR_INVALID_UNICODE_ESCAPE;
        }
      }
    } else if (strchr("\"\\/bfnrt", text[cursor]) == NULL) {
      return JSON_ERROR_INVALID_ESCAPE;
    }
  }
  return JSON_ERROR_UNTERMINATED_STRING;
}

/** Scans the primitive starting at `*position`, leaving it on its last byte. */
static JsonResultCode jsonParsePrimitive(
  JsonParserState *state,
  const char      *text,
  const uint32_t   textLength,
  uint32_t        *position
) {
  const uint32_t start = *position;
  uint32_t       end   = start;
  while (end < textLength && !jsonIsPrimitiveDelimiter(text[end])) {
    end++;
  }
  *position = end - 1;
  return jsonAppendToken(state, JSON_TOKEN_PRIMITIVE, start, end);
}

static JsonResultCode jsonParseCharacter(
  JsonParserState *state,
  const char      *text,
  const uint32_t   textLength,
  uint32_t        *position
) {
  const char character = text[*position];
  switch (character) {
  case '{':
    return jsonOpenContainer(state, JSON_TOKEN_OBJECT, *position);
  case '[':
    return jsonOpenContainer(state, JSON_TOKEN_ARRAY, *position);
  case '}':
    return jsonCloseContainer(state, JSON_TOKEN_OBJECT, *position);
  case ']':
    return jsonCloseContainer(state, JSON_TOKEN_ARRAY, *position);
  case '"':
    return jsonParseString(state, text, textLength, position);
  case ':':
    /** The key just parsed becomes the parent of the upcoming value. */
    state->superior = (int32_t)state->count - 1;
    return JSON_RESULT_OK;
  case ',':
    /** After a member's value, climb from its key back to the object. */
    if (state->superior != JSON_NOT_FOUND
        && !jsonIsContainer(state->tokens[state->superior].kind)) {
      state->superior = state->tokens[state->superior].parent;
    }
    return JSON_RESULT_OK;
  default:
    break;
  }
  if (jsonIsWhitespace(character)) {
    return JSON_RESULT_OK;
  }
  if (jsonIsPrimitiveStart(character)) {
    return jsonParsePrimitive(state, text, textLength, position);
  }
  return JSON_ERROR_UNEXPECTED_CHARACTER;
}

static JsonParseResult jsonParse(
  const char *text,
  const size_t textLength,
  JsonToken  *tokens,
  const uint32_t tokenCapacity
) {
  JsonParserState state = {
    .tokens   = tokens,
    .capacity = tokenCapacity,
    .count    = 0,
    .superior = JSON_NOT_FOUND,
  };
  const uint32_t length = (uint32_t)textLength;

  for (uint32_t position = 0; position < length; position++) {
    const JsonResultCode code =
      jsonParseCharacter(&state, text, length, &position);
    if (code != JSON_RESULT_OK) {
      return (JsonParseResult){.code = code, .tokenCount = 0};
    }
  }

  if (state.count == 0) {
    return (JsonParseResult){.code = JSON_ERROR_EMPTY_DOCUMENT, .tokenCount = 0};
  }
  for (uint32_t index = 0; index < state.count; index++) {
    if (tokens[index].end == JSON_OPEN_CONTAINER_END) {
      return (JsonParseResult){
        .code       = JSON_ERROR_UNCLOSED_CONTAINER,
        .tokenCount = 0,
      };
    }
  }
  return (JsonParseResult){.code = JSON_RESULT_OK, .tokenCount = state.count};
}

static uint32_t jsonSkip(
  const JsonToken *tokens, const uint32_t tokenCount, const uint32_t tokenIndex
) {
  uint32_t index          = tokenIndex;
  uint32_t remainingCount = 1;
  while (remainingCount > 0 && index < tokenCount) {
    remainingCount += tokens[index].childCount;
    remainingCount--;
    index++;
  }
  return index;
}

static bool jsonIsValidIndex(const uint32_t tokenCount, const int32_t tokenIndex) {
  return tokenIndex >= 0 && (uint32_t)tokenIndex < tokenCount;
}

static bool jsonEquals(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    tokenIndex,
  const char      *literal
) {
  if (!jsonIsValidIndex(tokenCount, tokenIndex)) {
    return false;
  }
  const JsonToken *token        = &tokens[tokenIndex];
  const size_t     tokenLength  = token->end - token->start;
  const size_t     literalLength = strlen(literal);
  return tokenLength == literalLength
      && memcmp(text + token->start, literal, literalLength) == 0;
}

static int32_t jsonFindMember(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    objectIndex,
  const char      *key
) {
  if (!jsonIsValidIndex(tokenCount, objectIndex)
      || tokens[objectIndex].kind != JSON_TOKEN_OBJECT) {
    return JSON_NOT_FOUND;
  }
  uint32_t keyIndex = (uint32_t)objectIndex + 1;
  for (uint32_t member = 0; member < tokens[objectIndex].childCount; member++) {
    if (keyIndex + 1 >= tokenCount) {
      return JSON_NOT_FOUND;
    }
    if (jsonEquals(text, tokens, tokenCount, (int32_t)keyIndex, key)) {
      return (int32_t)keyIndex + 1;
    }
    keyIndex = jsonSkip(tokens, tokenCount, keyIndex);
  }
  return JSON_NOT_FOUND;
}

static int32_t jsonArrayElement(
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    arrayIndex,
  const uint32_t   position
) {
  if (!jsonIsValidIndex(tokenCount, arrayIndex)
      || tokens[arrayIndex].kind != JSON_TOKEN_ARRAY
      || position >= tokens[arrayIndex].childCount) {
    return JSON_NOT_FOUND;
  }
  uint32_t elementIndex = (uint32_t)arrayIndex + 1;
  for (uint32_t skipped = 0; skipped < position; skipped++) {
    elementIndex = jsonSkip(tokens, tokenCount, elementIndex);
  }
  return elementIndex < tokenCount ? (int32_t)elementIndex : JSON_NOT_FOUND;
}

static uint32_t jsonReadHexadecimalQuad(const char *digits) {
  uint32_t value = 0;
  for (uint32_t digit = 0; digit < JSON_UNICODE_ESCAPE_DIGITS; digit++) {
    value = (value << 4) | (uint32_t)jsonHexadecimalValue(digits[digit]);
  }
  return value;
}

/** Number of UTF-8 bytes needed to encode `codePoint`. */
static size_t jsonUtf8Length(const uint32_t codePoint) {
  if (codePoint < 0x80) {
    return 1;
  }
  if (codePoint < 0x800) {
    return 2;
  }
  if (codePoint < JSON_SUPPLEMENTARY_PLANE_OFFSET) {
    return 3;
  }
  return 4;
}

static void jsonEncodeUtf8(const uint32_t codePoint, char *destination) {
  const size_t length = jsonUtf8Length(codePoint);
  if (length == 1) {
    destination[0] = (char)codePoint;
    return;
  }
  /** Leading-byte markers for 2, 3 and 4 byte sequences. */
  static const uint32_t LEADING_MARKERS[] = {0, 0, 0xC0, 0xE0, 0xF0};
  uint32_t              remaining         = codePoint;
  for (size_t index = length - 1; index > 0; index--) {
    destination[index] = (char)(0x80 | (remaining & 0x3F));
    remaining >>= 6;
  }
  destination[0] = (char)(LEADING_MARKERS[length] | remaining);
}

/**
 * Decodes the `\u` escape at `source` (pointing at the `u`), consuming a
 * following low surrogate when the first unit is a high surrogate.
 */
static uint32_t jsonDecodeUnicodeEscape(
  const char *source, const char *sourceEnd, uint32_t *consumedLength
) {
  const uint32_t firstUnit = jsonReadHexadecimalQuad(source + 1);
  *consumedLength          = 1 + JSON_UNICODE_ESCAPE_DIGITS;

  const char *next = source + *consumedLength;
  const bool  hasLowSurrogateEscape =
    firstUnit >= JSON_HIGH_SURROGATE_FIRST
    && firstUnit <= JSON_HIGH_SURROGATE_LAST
    && sourceEnd - next >= (ptrdiff_t)(2 + JSON_UNICODE_ESCAPE_DIGITS)
    && next[0] == '\\' && next[1] == 'u';
  if (!hasLowSurrogateEscape) {
    return firstUnit;
  }
  const uint32_t secondUnit = jsonReadHexadecimalQuad(next + 2);
  if (secondUnit < JSON_LOW_SURROGATE_FIRST
      || secondUnit > JSON_LOW_SURROGATE_LAST) {
    return firstUnit;
  }
  *consumedLength += 2 + JSON_UNICODE_ESCAPE_DIGITS;
  return JSON_SUPPLEMENTARY_PLANE_OFFSET
       + ((firstUnit - JSON_HIGH_SURROGATE_FIRST) << 10)
       + (secondUnit - JSON_LOW_SURROGATE_FIRST);
}

static char jsonSimpleEscapeValue(const char escape) {
  switch (escape) {
  case 'b':
    return '\b';
  case 'f':
    return '\f';
  case 'n':
    return '\n';
  case 'r':
    return '\r';
  case 't':
    return '\t';
  default:
    return escape; // '"', '\\' and '/' stand for themselves
  }
}

static JsonResultCode jsonCopyString(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    tokenIndex,
  char            *destination,
  const size_t     destinationCapacity
) {
  if (!jsonIsValidIndex(tokenCount, tokenIndex)) {
    return JSON_ERROR_INVALID_TOKEN_INDEX;
  }
  const JsonToken *token = &tokens[tokenIndex];
  if (token->kind != JSON_TOKEN_STRING) {
    return JSON_ERROR_WRONG_TOKEN_KIND;
  }

  const char *source    = text + token->start;
  const char *sourceEnd = text + token->end;
  size_t      written   = 0;
  while (source < sourceEnd) {
    char     encoded[4];
    size_t   encodedLength = 1;
    uint32_t consumed      = 1;
    if (*source != '\\') {
      encoded[0] = *source;
    } else if (source[1] == 'u') {
      const uint32_t codePoint =
        jsonDecodeUnicodeEscape(source + 1, sourceEnd, &consumed);
      consumed++; // the backslash
      encodedLength = jsonUtf8Length(codePoint);
      jsonEncodeUtf8(codePoint, encoded);
    } else {
      encoded[0] = jsonSimpleEscapeValue(source[1]);
      consumed   = 2;
    }
    if (written + encodedLength >= destinationCapacity) {
      return JSON_ERROR_DESTINATION_TOO_SMALL;
    }
    memcpy(destination + written, encoded, encodedLength);
    written += encodedLength;
    source += consumed;
  }
  destination[written] = '\0';
  return JSON_RESULT_OK;
}

static JsonResultCode jsonReadBoolean(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    tokenIndex,
  bool            *value
) {
  if (!jsonIsValidIndex(tokenCount, tokenIndex)) {
    return JSON_ERROR_INVALID_TOKEN_INDEX;
  }
  if (jsonEquals(text, tokens, tokenCount, tokenIndex, "true")) {
    *value = true;
    return JSON_RESULT_OK;
  }
  if (jsonEquals(text, tokens, tokenCount, tokenIndex, "false")) {
    *value = false;
    return JSON_RESULT_OK;
  }
  return JSON_ERROR_INVALID_BOOLEAN;
}

static JsonResultCode jsonReadInteger(
  const char      *text,
  const JsonToken *tokens,
  const uint32_t   tokenCount,
  const int32_t    tokenIndex,
  int64_t         *value
) {
  if (!jsonIsValidIndex(tokenCount, tokenIndex)) {
    return JSON_ERROR_INVALID_TOKEN_INDEX;
  }
  const JsonToken *token  = &tokens[tokenIndex];
  const size_t     length = token->end - token->start;
  if (token->kind != JSON_TOKEN_PRIMITIVE || length == 0
      || length >= JSON_NUMBER_TEXT_CAPACITY) {
    return JSON_ERROR_INVALID_NUMBER;
  }

  /** strtoll needs a terminator the source text does not have. */
  char numberText[JSON_NUMBER_TEXT_CAPACITY];
  memcpy(numberText, text + token->start, length);
  numberText[length] = '\0';

  char         *parsedEnd = NULL;
  const int64_t parsed    = strtoll(numberText, &parsedEnd, 10);
  if (parsedEnd != numberText + length) {
    return JSON_ERROR_INVALID_NUMBER;
  }
  *value = parsed;
  return JSON_RESULT_OK;
}

const struct JsonType JsonI = {
  .parse        = jsonParse,
  .skip         = jsonSkip,
  .findMember   = jsonFindMember,
  .arrayElement = jsonArrayElement,
  .equals       = jsonEquals,
  .copyString   = jsonCopyString,
  .readBoolean  = jsonReadBoolean,
  .readInteger  = jsonReadInteger,
};

static JsonWriter jsonWriterCreate(char *buffer, const size_t capacity) {
  buffer[0] = '\0';
  return (JsonWriter){
    .buffer         = buffer,
    .capacity       = capacity,
    .length         = 0,
    .needsSeparator = false,
    .overflowed     = false,
  };
}

static void jsonWriterAppend(
  JsonWriter *writer, const char *bytes, const size_t byteCount
) {
  if (writer->overflowed) {
    return;
  }
  if (writer->length + byteCount >= writer->capacity) {
    writer->overflowed = true;
    return;
  }
  memcpy(writer->buffer + writer->length, bytes, byteCount);
  writer->length += byteCount;
  writer->buffer[writer->length] = '\0';
}

static void jsonWriterAppendText(JsonWriter *writer, const char *text) {
  jsonWriterAppend(writer, text, strlen(text));
}

static void jsonWriterSeparate(JsonWriter *writer) {
  if (writer->needsSeparator) {
    jsonWriterAppend(writer, ",", 1);
  }
}

static void jsonWriterAppendEscaped(JsonWriter *writer, const char *value) {
  jsonWriterAppend(writer, "\"", 1);
  for (const char *cursor = value; *cursor != '\0'; cursor++) {
    const char character = *cursor;
    switch (character) {
    case '"':
      jsonWriterAppendText(writer, "\\\"");
      break;
    case '\\':
      jsonWriterAppendText(writer, "\\\\");
      break;
    case '\n':
      jsonWriterAppendText(writer, "\\n");
      break;
    case '\r':
      jsonWriterAppendText(writer, "\\r");
      break;
    case '\t':
      jsonWriterAppendText(writer, "\\t");
      break;
    default:
      if ((unsigned char)character < JSON_FIRST_PRINTABLE_CHARACTER) {
        char escape[sizeof("\\u0000")];
        snprintf(escape, sizeof(escape), "\\u%04x", (uint32_t)character);
        jsonWriterAppendText(writer, escape);
      } else {
        jsonWriterAppend(writer, &character, 1);
      }
      break;
    }
  }
  jsonWriterAppend(writer, "\"", 1);
}

static void jsonWriterOpen(JsonWriter *writer, const char *bracket) {
  jsonWriterSeparate(writer);
  jsonWriterAppendText(writer, bracket);
  writer->needsSeparator = false;
}

static void jsonWriterClose(JsonWriter *writer, const char *bracket) {
  jsonWriterAppendText(writer, bracket);
  writer->needsSeparator = true;
}

static void jsonWriterBeginObject(JsonWriter *writer) {
  jsonWriterOpen(writer, "{");
}

static void jsonWriterEndObject(JsonWriter *writer) {
  jsonWriterClose(writer, "}");
}

static void jsonWriterBeginArray(JsonWriter *writer) {
  jsonWriterOpen(writer, "[");
}

static void jsonWriterEndArray(JsonWriter *writer) {
  jsonWriterClose(writer, "]");
}

static void jsonWriterKey(JsonWriter *writer, const char *name) {
  jsonWriterSeparate(writer);
  jsonWriterAppendEscaped(writer, name);
  jsonWriterAppend(writer, ":", 1);
  writer->needsSeparator = false;
}

/** Writes an already-formatted scalar value. */
static void jsonWriterValue(JsonWriter *writer, const char *formatted) {
  jsonWriterSeparate(writer);
  jsonWriterAppendText(writer, formatted);
  writer->needsSeparator = true;
}

static void jsonWriterString(JsonWriter *writer, const char *value) {
  jsonWriterSeparate(writer);
  jsonWriterAppendEscaped(writer, value);
  writer->needsSeparator = true;
}

static void jsonWriterInteger(JsonWriter *writer, const int64_t value) {
  char formatted[JSON_NUMBER_TEXT_CAPACITY];
  snprintf(formatted, sizeof(formatted), "%" PRId64, value);
  jsonWriterValue(writer, formatted);
}

static void jsonWriterUnsignedInteger(JsonWriter *writer, const uint64_t value) {
  char formatted[JSON_NUMBER_TEXT_CAPACITY];
  snprintf(formatted, sizeof(formatted), "%" PRIu64, value);
  jsonWriterValue(writer, formatted);
}

static void jsonWriterDecimal(JsonWriter *writer, const double value) {
  /** JSON has no representation for NaN or infinity. */
  if (!isfinite(value)) {
    jsonWriterValue(writer, "null");
    return;
  }
  char formatted[JSON_NUMBER_TEXT_CAPACITY];
  snprintf(formatted, sizeof(formatted), "%.2f", value);
  jsonWriterValue(writer, formatted);
}

static void jsonWriterBoolean(JsonWriter *writer, const bool value) {
  jsonWriterValue(writer, value ? "true" : "false");
}

static JsonResultCode jsonWriterFinish(const JsonWriter *writer) {
  return writer->overflowed ? JSON_ERROR_WRITER_OVERFLOW : JSON_RESULT_OK;
}

const struct JsonWriterType JsonWriterI = {
  .create          = jsonWriterCreate,
  .beginObject     = jsonWriterBeginObject,
  .endObject       = jsonWriterEndObject,
  .beginArray      = jsonWriterBeginArray,
  .endArray        = jsonWriterEndArray,
  .key             = jsonWriterKey,
  .string          = jsonWriterString,
  .integer         = jsonWriterInteger,
  .unsignedInteger = jsonWriterUnsignedInteger,
  .decimal         = jsonWriterDecimal,
  .boolean         = jsonWriterBoolean,
  .finish          = jsonWriterFinish,
};
