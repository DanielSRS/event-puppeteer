#include "json/json.h"
#include "testing/testing.h"

#include <string.h>

/** Generous token budget for the small documents used in these tests. */
#define JSON_TEST_TOKEN_CAPACITY ((uint32_t)64)

/** Destination size for decoded strings in these tests. */
#define JSON_TEST_STRING_CAPACITY ((size_t)128)

static JsonParseResult jsonTestParse(const char *text, JsonToken *tokens) {
  return JsonI.parse(text, strlen(text), tokens, JSON_TEST_TOKEN_CAPACITY);
}

static void jsonParsesNestedDocument(TestContext *context) {
  const char *text =
    "{\"device\":{\"id\":\"abc\",\"tags\":[1,2]},\"token\":\"xyz\"}";
  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);

  EXPECT(context, parsed.code == JSON_RESULT_OK);
  EXPECT(context, tokens[0].kind == JSON_TOKEN_OBJECT);
  EXPECT(context, tokens[0].childCount == 2);

  const int32_t tokenIndex =
    JsonI.findMember(text, tokens, parsed.tokenCount, 0, "token");
  EXPECT(context, JsonI.equals(text, tokens, parsed.tokenCount, tokenIndex, "xyz"));

  const int32_t deviceIndex =
    JsonI.findMember(text, tokens, parsed.tokenCount, 0, "device");
  const int32_t idIndex =
    JsonI.findMember(text, tokens, parsed.tokenCount, deviceIndex, "id");
  EXPECT(context, JsonI.equals(text, tokens, parsed.tokenCount, idIndex, "abc"));
}

static void jsonFindsArrayElements(TestContext *context) {
  const char           *text = "[{\"a\":[1,2,3]},true,\"last\"]";
  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);

  EXPECT(context, parsed.code == JSON_RESULT_OK);
  EXPECT(context, tokens[0].childCount == 3);

  const int32_t lastIndex =
    JsonI.arrayElement(tokens, parsed.tokenCount, 0, 2);
  EXPECT(context, JsonI.equals(text, tokens, parsed.tokenCount, lastIndex, "last"));

  bool          flag      = false;
  const int32_t flagIndex = JsonI.arrayElement(tokens, parsed.tokenCount, 0, 1);
  EXPECT(
    context,
    JsonI.readBoolean(text, tokens, parsed.tokenCount, flagIndex, &flag)
      == JSON_RESULT_OK
  );
  EXPECT(context, flag);
  EXPECT(
    context, JsonI.arrayElement(tokens, parsed.tokenCount, 0, 3) == JSON_NOT_FOUND
  );
}

static void jsonReportsMissingMember(TestContext *context) {
  const char           *text = "{\"a\":1}";
  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);

  EXPECT(
    context,
    JsonI.findMember(text, tokens, parsed.tokenCount, 0, "b") == JSON_NOT_FOUND
  );
  EXPECT(
    context,
    JsonI.findMember(text, tokens, parsed.tokenCount, 1, "a") == JSON_NOT_FOUND
  );
}

static void jsonDecodesEscapes(TestContext *context) {
  const char *text = "\"line\\nquote\\\" acento \\u00e9 \\ud83d\\ude00\"";
  JsonToken   tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);
  char                  decoded[JSON_TEST_STRING_CAPACITY];

  EXPECT(
    context,
    JsonI.copyString(
      text, tokens, parsed.tokenCount, 0, decoded, sizeof(decoded)
    ) == JSON_RESULT_OK
  );
  EXPECT(
    context,
    strcmp(decoded, "line\nquote\" acento \xc3\xa9 \xf0\x9f\x98\x80") == 0
  );
}

static void jsonRejectsSmallDestination(TestContext *context) {
  const char           *text = "\"abcdef\"";
  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);
  char                  decoded[4];

  EXPECT(
    context,
    JsonI.copyString(text, tokens, parsed.tokenCount, 0, decoded, sizeof(decoded))
      == JSON_ERROR_DESTINATION_TOO_SMALL
  );
}

static void jsonReadsIntegers(TestContext *context) {
  const char           *text = "{\"count\":-42,\"bad\":4.5}";
  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(text, tokens);
  int64_t               value  = 0;

  const int32_t countIndex =
    JsonI.findMember(text, tokens, parsed.tokenCount, 0, "count");
  EXPECT(
    context,
    JsonI.readInteger(text, tokens, parsed.tokenCount, countIndex, &value)
      == JSON_RESULT_OK
  );
  EXPECT(context, value == -42);

  const int32_t badIndex =
    JsonI.findMember(text, tokens, parsed.tokenCount, 0, "bad");
  EXPECT(
    context,
    JsonI.readInteger(text, tokens, parsed.tokenCount, badIndex, &value)
      == JSON_ERROR_INVALID_NUMBER
  );
}

static void jsonRejectsMalformedDocuments(TestContext *context) {
  JsonToken tokens[JSON_TEST_TOKEN_CAPACITY];

  EXPECT(context, jsonTestParse("{\"a\":1]", tokens).code == JSON_ERROR_MISMATCHED_BRACKET);
  EXPECT(context, jsonTestParse("{\"a\":1", tokens).code == JSON_ERROR_UNCLOSED_CONTAINER);
  EXPECT(context, jsonTestParse("\"abc", tokens).code == JSON_ERROR_UNTERMINATED_STRING);
  EXPECT(context, jsonTestParse("]", tokens).code == JSON_ERROR_UNEXPECTED_CLOSING_BRACKET);
  EXPECT(context, jsonTestParse("\"\\x\"", tokens).code == JSON_ERROR_INVALID_ESCAPE);
  EXPECT(context, jsonTestParse("\"\\u12\"", tokens).code == JSON_ERROR_INVALID_UNICODE_ESCAPE);
  EXPECT(context, jsonTestParse("{@}", tokens).code == JSON_ERROR_UNEXPECTED_CHARACTER);
  EXPECT(context, jsonTestParse("  ", tokens).code == JSON_ERROR_EMPTY_DOCUMENT);
}

static void jsonRejectsTokenOverflow(TestContext *context) {
  const char *text = "[1,2,3]";
  JsonToken   tokens[2];

  EXPECT(
    context,
    JsonI.parse(text, strlen(text), tokens, 2).code
      == JSON_ERROR_TOKEN_CAPACITY_EXCEEDED
  );
}

static void jsonWritesNestedDocument(TestContext *context) {
  char       buffer[JSON_TEST_STRING_CAPACITY];
  JsonWriter writer = JsonWriterI.create(buffer, sizeof(buffer));

  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "status");
  JsonWriterI.string(&writer, "ok \"quoted\"\n");
  JsonWriterI.key(&writer, "errors");
  JsonWriterI.beginArray(&writer);
  JsonWriterI.string(&writer, "a");
  JsonWriterI.integer(&writer, -1);
  JsonWriterI.endArray(&writer);
  JsonWriterI.key(&writer, "load");
  JsonWriterI.decimal(&writer, 12.345);
  JsonWriterI.key(&writer, "on");
  JsonWriterI.boolean(&writer, true);
  JsonWriterI.endObject(&writer);

  EXPECT(context, JsonWriterI.finish(&writer) == JSON_RESULT_OK);
  EXPECT(
    context,
    strcmp(
      buffer,
      "{\"status\":\"ok \\\"quoted\\\"\\n\",\"errors\":[\"a\",-1],"
      "\"load\":12.35,\"on\":true}"
    ) == 0
  );
}

static void jsonWriterReportsOverflow(TestContext *context) {
  char       buffer[8];
  JsonWriter writer = JsonWriterI.create(buffer, sizeof(buffer));

  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "long-key-name");
  JsonWriterI.endObject(&writer);

  EXPECT(context, JsonWriterI.finish(&writer) == JSON_ERROR_WRITER_OVERFLOW);
  EXPECT(context, strlen(buffer) < sizeof(buffer));
}

static void jsonWriterOutputParsesBack(TestContext *context) {
  char       buffer[JSON_TEST_STRING_CAPACITY];
  JsonWriter writer = JsonWriterI.create(buffer, sizeof(buffer));
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "message");
  JsonWriterI.string(&writer, "tab\there \x01");
  JsonWriterI.endObject(&writer);

  JsonToken             tokens[JSON_TEST_TOKEN_CAPACITY];
  const JsonParseResult parsed = jsonTestParse(buffer, tokens);
  char                  decoded[JSON_TEST_STRING_CAPACITY];
  const int32_t         messageIndex =
    JsonI.findMember(buffer, tokens, parsed.tokenCount, 0, "message");

  EXPECT(context, parsed.code == JSON_RESULT_OK);
  EXPECT(
    context,
    JsonI.copyString(
      buffer, tokens, parsed.tokenCount, messageIndex, decoded, sizeof(decoded)
    ) == JSON_RESULT_OK
  );
  EXPECT(context, strcmp(decoded, "tab\there \x01") == 0);
}

static const TestCase JSON_TEST_CASES[] = {
  {"parses a nested document and finds members", jsonParsesNestedDocument},
  {"finds array elements by position", jsonFindsArrayElements},
  {"reports missing members", jsonReportsMissingMember},
  {"decodes escapes including surrogate pairs", jsonDecodesEscapes},
  {"rejects destinations that are too small", jsonRejectsSmallDestination},
  {"reads integers and rejects decimals", jsonReadsIntegers},
  {"rejects malformed documents", jsonRejectsMalformedDocuments},
  {"rejects documents exceeding token capacity", jsonRejectsTokenOverflow},
  {"writes a nested document with escapes", jsonWritesNestedDocument},
  {"reports writer overflow", jsonWriterReportsOverflow},
  {"writer output parses back", jsonWriterOutputParsesBack},
};

static const TestSuite JsonTestSuite = {
  .name      = "json",
  .cases     = JSON_TEST_CASES,
  .caseCount = sizeof(JSON_TEST_CASES) / sizeof(JSON_TEST_CASES[0]),
};
