#include "http-client.h"

#include <curl/curl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/** Maximum length of the full URL (base + path). */
#define FULL_URL_CAPACITY ((size_t)512)

/**
 * Bounds on a single request, so an unresponsive network can never stall the
 * agent loop (and with it heartbeats and termination handling).
 */
#define HTTP_CONNECT_TIMEOUT_SECONDS ((long)10)
#define HTTP_TOTAL_TIMEOUT_SECONDS   ((long)30)

/**
 * Internal structure backing the opaque HttpClient handle.
 *
 * The response arena is a fixed-size buffer reused across calls.
 * `responseBufferUsed` tracks how many bytes were written during the
 * most recent transfer; it is reset at the start of each request.
 */
struct HttpClient {
  CURL *curl;
  char baseUrl[FULL_URL_CAPACITY];
  char responseBuffer[HTTP_RESPONSE_BUFFER_CAPACITY];
  size_t responseBufferUsed;
  int32_t wasTruncated;
};

/** libcurl write callback: appends received data into the client's arena. */
static size_t httpClientWriteCallback(
  const char *data, size_t itemSize, size_t itemCount, void *userPointer
) {
  struct HttpClient *client = (struct HttpClient *)userPointer;
  const size_t incomingBytes = itemSize * itemCount;

  /** Bytes still available in the buffer, reserving one byte for the null
   *  terminator. */
  const size_t remainingCapacity =
    HTTP_RESPONSE_BUFFER_CAPACITY - client->responseBufferUsed - 1;

  const size_t bytesToCopy =
    incomingBytes < remainingCapacity ? incomingBytes : remainingCapacity;

  if (bytesToCopy < incomingBytes) {
    client->wasTruncated = 1;
  }

  memcpy(
    client->responseBuffer + client->responseBufferUsed, data, bytesToCopy
  );
  client->responseBufferUsed += bytesToCopy;

  /** Returning incomingBytes (not bytesToCopy) prevents libcurl from treating
   *  the overflow as a write error. We handle the truncation ourselves. */
  return incomingBytes;
}

static HttpResult httpClientInitialize(void) {
  const CURLcode status = curl_global_init(CURL_GLOBAL_DEFAULT);
  if (status != CURLE_OK) {
    return (HttpResult){
      .code     = HTTP_RESULT_ERROR,
      .curlCode = (int32_t)status,
    };
  }
  return (HttpResult){.code = HTTP_RESULT_OK};
}

static void httpClientCleanup(void) {
  curl_global_cleanup();
}

static HttpClient *httpClientCreate(const char *baseUrl) {
  HttpClient *client = malloc(sizeof(HttpClient));
  if (!client) {
    return NULL;
  }

  client->curl = curl_easy_init();
  if (!client->curl) {
    free(client);
    return NULL;
  }

  curl_easy_setopt(
    client->curl, CURLOPT_CONNECTTIMEOUT, HTTP_CONNECT_TIMEOUT_SECONDS
  );
  curl_easy_setopt(client->curl, CURLOPT_TIMEOUT, HTTP_TOTAL_TIMEOUT_SECONDS);
  /** libcurl's default DNS timeout relies on SIGALRM; signals are owned by
   *  the lifecycle module. */
  curl_easy_setopt(client->curl, CURLOPT_NOSIGNAL, 1L);

  strncpy(client->baseUrl, baseUrl, FULL_URL_CAPACITY - 1);
  client->baseUrl[FULL_URL_CAPACITY - 1] = '\0';
  client->responseBufferUsed = 0;
  client->wasTruncated = 0;

  return client;
}

static void httpClientDestroy(HttpClient *client) {
  if (!client) {
    return;
  }
  curl_easy_cleanup(client->curl);
  free(client);
}

static void httpClientResetResponseBuffer(HttpClient *client) {
  client->responseBufferUsed = 0;
  client->wasTruncated = 0;
  client->responseBuffer[0] = '\0';
}

static HttpResult httpClientBuildResult(const HttpClient *client, const CURLcode status) {
  if (status != CURLE_OK) {
    return (HttpResult){
      .code     = HTTP_RESULT_ERROR,
      .curlCode = (int32_t)status,
    };
  }

  /** libcurl's ABI mandates a `long` here; a wider type would be only
   *  partially written on 32-bit targets such as ARM32. */
  long httpStatus = 0;
  curl_easy_getinfo(client->curl, CURLINFO_RESPONSE_CODE, &httpStatus);

  const HttpResultCode resultCode =
    client->wasTruncated ? HTTP_RESULT_BODY_TRUNCATED : HTTP_RESULT_OK;

  return (HttpResult){
    .code       = resultCode,
    .httpStatus = (int32_t)httpStatus,
    .body       = client->responseBuffer,
    .bodyLength = client->responseBufferUsed,
  };
}

static struct curl_slist *httpClientBuildHeaderList(
  struct curl_slist *list, const HttpExtraHeaders *extraHeaders
) {
  if (!extraHeaders) {
    return list;
  }
  for (uint32_t index = 0; index < extraHeaders->count; index++) {
    list = curl_slist_append(list, extraHeaders->headers[index]);
  }
  return list;
}

static HttpResult httpClientGet(
  HttpClient *client,
  const char *path,
  const HttpExtraHeaders *extraHeaders
) {
  httpClientResetResponseBuffer(client);

  char fullUrl[FULL_URL_CAPACITY];
  snprintf(fullUrl, FULL_URL_CAPACITY, "%s%s", client->baseUrl, path);

  struct curl_slist *headers = httpClientBuildHeaderList(NULL, extraHeaders);

  curl_easy_setopt(client->curl, CURLOPT_URL, fullUrl);
  curl_easy_setopt(client->curl, CURLOPT_HTTPGET, 1L);
  curl_easy_setopt(client->curl, CURLOPT_WRITEFUNCTION, httpClientWriteCallback);
  curl_easy_setopt(client->curl, CURLOPT_WRITEDATA, client);
  curl_easy_setopt(client->curl, CURLOPT_HTTPHEADER, headers);

  const CURLcode status = curl_easy_perform(client->curl);

  if (headers) {
    curl_slist_free_all(headers);
  }

  /** Ensure the buffer is always null-terminated. */
  client->responseBuffer[client->responseBufferUsed] = '\0';

  return httpClientBuildResult(client, status);
}

static HttpResult httpClientPost(
  HttpClient *client,
  const char *path,
  const char *jsonBody,
  const HttpExtraHeaders *extraHeaders
) {
  httpClientResetResponseBuffer(client);

  char fullUrl[FULL_URL_CAPACITY];
  snprintf(fullUrl, FULL_URL_CAPACITY, "%s%s", client->baseUrl, path);

  const char *body = jsonBody ? jsonBody : "";
  const size_t bodyLength = strlen(body);

  struct curl_slist *headers =
    curl_slist_append(NULL, "Content-Type: application/json");
  headers = httpClientBuildHeaderList(headers, extraHeaders);

  curl_easy_setopt(client->curl, CURLOPT_URL, fullUrl);
  curl_easy_setopt(client->curl, CURLOPT_POST, 1L);
  curl_easy_setopt(client->curl, CURLOPT_POSTFIELDS, body);
  curl_easy_setopt(client->curl, CURLOPT_POSTFIELDSIZE, (long)bodyLength);
  curl_easy_setopt(client->curl, CURLOPT_WRITEFUNCTION, httpClientWriteCallback);
  curl_easy_setopt(client->curl, CURLOPT_WRITEDATA, client);
  curl_easy_setopt(client->curl, CURLOPT_HTTPHEADER, headers);

  const CURLcode status = curl_easy_perform(client->curl);

  curl_slist_free_all(headers);

  /** Ensure the buffer is always null-terminated. */
  client->responseBuffer[client->responseBufferUsed] = '\0';

  return httpClientBuildResult(client, status);
}

const struct HttpClientType HttpClientI = {
  .initialize = httpClientInitialize,
  .cleanup    = httpClientCleanup,
  .create     = httpClientCreate,
  .destroy    = httpClientDestroy,
  .get        = httpClientGet,
  .post       = httpClientPost,
};
