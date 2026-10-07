/**
 * @file http-client.h
 * @brief HTTP client for communicating with the Puppeteer server.
 *
 * This module provides a minimal, lifecycle-safe HTTP client built on libcurl.
 * All network communication between Puppet and Puppeteer flows through this
 * interface.
 *
 * ## Lifecycle
 *
 * Before making any requests, call `HttpClientI.initialize()` once at program
 * startup. Call `HttpClientI.cleanup()` once at program exit. These correspond
 * to `curl_global_init` / `curl_global_cleanup` and must not be called
 * concurrently.
 *
 * ## Performing Requests
 *
 * Create an `HttpRequest` on the stack, fill in the fields, then call the
 * appropriate method (`get` or `post`). The returned `HttpResponse` is
 * self-contained: `body` points into an internal buffer that is valid until
 * the next call on the same `HttpClient` handle, or until the handle is
 * destroyed.
 *
 * ## Memory Model
 *
 * `HttpClientI.create()` allocates a handle backed by an internal response
 * arena (a single reusable buffer). No per-request heap allocations are made
 * after creation. `HttpClientI.destroy()` releases the handle and its arena.
 *
 * ## Error Handling
 *
 * Every operation returns an `HttpResult`. On failure, `HttpResult.code` is
 * `HTTP_RESULT_ERROR` and `HttpResult.curlCode` carries the raw libcurl error
 * code for diagnostics.
 *
 * ## Example
 *
 * ```c
 * HttpClientI.initialize();
 *
 * HttpClient *client = HttpClientI.create("https://puppeteer.example.com");
 *
 * HttpResult result = HttpClientI.post(
 *     client,
 *     "/api/v1/devices/register",
 *     "{\"orgId\": \"abc123\"}",
 *     NULL   // no extra headers
 * );
 *
 * if (result.code == HTTP_RESULT_OK) {
 *     printf("Status: %d  Body: %s\n", result.httpStatus, result.body);
 * }
 *
 * HttpClientI.destroy(client);
 * HttpClientI.cleanup();
 * ```
 */
#ifndef PUPPET_HTTP_CLIENT_H_
#define PUPPET_HTTP_CLIENT_H_

#include <stdint.h>

/** Maximum size of the response body buffer (64 KiB). */
#define HTTP_RESPONSE_BUFFER_CAPACITY ((size_t)65536)

/** Maximum number of extra headers per request. */
#define HTTP_MAX_EXTRA_HEADERS ((uint32_t)16)

/** Maximum length of a single header string (key: value\0). */
#define HTTP_MAX_HEADER_LENGTH ((uint32_t)256)

/**
 * Result codes returned by all HttpClient operations.
 */
typedef enum {
  /** The operation completed successfully. */
  HTTP_RESULT_OK = 0,

  /** A libcurl-level error occurred (network, TLS, timeout, etc.). */
  HTTP_RESULT_ERROR = 1,

  /** The response body was truncated because it exceeded the buffer capacity. */
  HTTP_RESULT_BODY_TRUNCATED = 2,
} HttpResultCode;

/**
 * The result of a single HTTP request.
 *
 * On `HTTP_RESULT_OK` and `HTTP_RESULT_BODY_TRUNCATED`, `httpStatus` and
 * `body` are valid. On `HTTP_RESULT_ERROR`, `curlCode` carries the raw libcurl
 * error for diagnostics; `httpStatus` is 0 and `body` is NULL.
 */
typedef struct {
  /** High-level result classification. */
  HttpResultCode code;

  /** HTTP status code returned by the server (e.g. 200, 404, 503). */
  int32_t httpStatus;

  /**
   * Null-terminated response body. Points into the client's internal buffer.
   * Valid until the next request on the same client handle.
   */
  const char *body;

  /**
   * Number of bytes written into the body buffer (excluding the null
   * terminator). Useful for `HTTP_RESULT_BODY_TRUNCATED` diagnostics.
   */
  size_t bodyLength;

  /**
   * Raw libcurl error code. Non-zero only when `code == HTTP_RESULT_ERROR`.
   * Cast to `CURLcode` (from `<curl/curl.h>`) for detailed diagnostics.
   */
  int32_t curlCode;
} HttpResult;

/**
 * An optional list of extra HTTP headers to attach to a single request.
 *
 * Populate `headers` with null-terminated "Key: Value" strings and set
 * `count` accordingly. Strings are read by the client but not owned; they
 * must remain valid for the duration of the call.
 *
 * Pass NULL to any request function when no extra headers are needed.
 */
typedef struct {
  /** Null-terminated "Key: Value" strings. */
  const char *headers[HTTP_MAX_EXTRA_HEADERS];

  /** Number of valid entries in `headers`. */
  uint32_t count;
} HttpExtraHeaders;

/**
 * Opaque HTTP client handle.
 *
 * Obtain via `HttpClientI.create()`. Destroy via `HttpClientI.destroy()`.
 * Do not share a single handle across threads without external synchronization.
 */
typedef struct HttpClient HttpClient;

/**
 * Public interface for the HTTP client module.
 */
struct HttpClientType {
  /**
   * Initialize the global libcurl state. Must be called once before any other
   * function in this module. Not thread-safe with respect to other libcurl
   * users in the same process.
   *
   * @return HTTP_RESULT_OK on success, HTTP_RESULT_ERROR on failure.
   */
  HttpResult (*const initialize)(void);

  /**
   * Release global libcurl resources. Must be called once at program exit,
   * after all handles have been destroyed.
   */
  void (*const cleanup)(void);

  /**
   * Create a new HTTP client handle bound to a base URL.
   *
   * @param baseUrl  Null-terminated base URL of the Puppeteer server
   *                 (e.g. "https://puppeteer.example.com"). Must not be NULL.
   *                 The string is copied internally.
   * @return A heap-allocated handle, or NULL if allocation failed.
   */
  HttpClient *(*const create)(const char *baseUrl);

  /**
   * Destroy a client handle and release its internal buffer.
   *
   * @param client  Handle returned by `create`. If NULL, this is a no-op.
   */
  void (*const destroy)(HttpClient *client);

  /**
   * Perform an HTTP GET request.
   *
   * @param client        Client handle obtained from `create`.
   * @param path          Null-terminated path (e.g. "/api/v1/health").
   *                      Appended to the base URL.
   * @param extraHeaders  Optional extra headers. Pass NULL if not needed.
   * @return `HttpResult` describing the outcome.
   */
  HttpResult (*const get)(
    HttpClient *client,
    const char *path,
    const HttpExtraHeaders *extraHeaders
  );

  /**
   * Perform an HTTP POST request with a JSON body.
   *
   * The `Content-Type: application/json` header is set automatically.
   *
   * @param client        Client handle obtained from `create`.
   * @param path          Null-terminated path (e.g. "/api/v1/devices/register").
   * @param jsonBody      Null-terminated JSON string to send as the body.
   *                      May be NULL or empty for an empty body.
   * @param extraHeaders  Optional extra headers. Pass NULL if not needed.
   * @return `HttpResult` describing the outcome.
   */
  HttpResult (*const post)(
    HttpClient *client,
    const char *path,
    const char *jsonBody,
    const HttpExtraHeaders *extraHeaders
  );
};

extern const struct HttpClientType HttpClientI;

#ifdef PUPPET_HTTP_CLIENT_IMPLEMENTATION
#include "http-client.c"
#endif

#endif // PUPPET_HTTP_CLIENT_H_
