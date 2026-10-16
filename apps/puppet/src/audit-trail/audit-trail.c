#include "audit-trail.h"

#include "json/json.h"

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdbool.h>
#include <string.h>
#include <sys/file.h>
#include <unistd.h>

/** Readable by whoever administers the Device, writable only by its owner. */
#define AUDIT_TRAIL_FILE_MODE ((mode_t)0644)

#define AUDIT_TRAIL_ENTRY_TERMINATOR '\n'

/** The terminator and the null character that follow the JSON object. */
#define AUDIT_TRAIL_SUFFIX_LENGTH ((size_t)2)

/** An entry has a root object, six members and the actor's own two. */
#define AUDIT_TRAIL_PARSE_TOKEN_CAPACITY ((uint32_t)32)
#define AUDIT_TRAIL_ROOT_TOKEN           ((int32_t)0)

/** Member names of an entry, shared by writing and reading it. */
#define AUDIT_TRAIL_WHAT_KEY  "what"
#define AUDIT_TRAIL_AFTER_KEY "after"

static const char *auditTrailActorKindName(const AuditTrailActorKind kind) {
  switch (kind) {
  case AUDIT_TRAIL_ACTOR_AGENT:
    return "agent";
  case AUDIT_TRAIL_ACTOR_COMMAND:
    return "command";
  case AUDIT_TRAIL_ACTOR_USER:
    break;
  }
  return "user";
}

static AuditTrailResultCode auditTrailFormat(
  const AuditTrailEntry *entry, char *buffer, const size_t capacity
) {
  JsonWriter writer = JsonWriterI.create(buffer, capacity);
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "when");
  JsonWriterI.string(&writer, entry->when);
  JsonWriterI.key(&writer, "who");
  JsonWriterI.beginObject(&writer);
  JsonWriterI.key(&writer, "kind");
  JsonWriterI.string(&writer, auditTrailActorKindName(entry->actor.kind));
  if (entry->actor.identifier != NULL) {
    JsonWriterI.key(&writer, "identifier");
    JsonWriterI.string(&writer, entry->actor.identifier);
  }
  JsonWriterI.endObject(&writer);
  JsonWriterI.key(&writer, AUDIT_TRAIL_WHAT_KEY);
  JsonWriterI.string(&writer, entry->what);
  JsonWriterI.key(&writer, "before");
  JsonWriterI.string(&writer, entry->before);
  JsonWriterI.key(&writer, AUDIT_TRAIL_AFTER_KEY);
  JsonWriterI.string(&writer, entry->after);
  JsonWriterI.endObject(&writer);
  if (JsonWriterI.finish(&writer) != JSON_RESULT_OK
      || writer.length + AUDIT_TRAIL_SUFFIX_LENGTH > capacity) {
    return AUDIT_TRAIL_ERROR_ENTRY_TOO_LARGE;
  }
  buffer[writer.length]     = AUDIT_TRAIL_ENTRY_TERMINATOR;
  buffer[writer.length + 1] = '\0';
  return AUDIT_TRAIL_RESULT_OK;
}

/**
 * Written in one `write` on an `O_APPEND` descriptor, so the kernel places
 * the whole entry at the end of the file. The `flock` additionally keeps a
 * short write of one process from being interleaved with another's.
 */
static AuditTrailResultCode auditTrailWrite(
  const int32_t descriptor, const char *line
) {
  if (flock(descriptor, LOCK_EX) != 0) {
    return AUDIT_TRAIL_ERROR_LOCK_FAILED;
  }
  const size_t  length  = strlen(line);
  const ssize_t written = write(descriptor, line, length);
  if (written < 0) {
    return AUDIT_TRAIL_ERROR_WRITE_FAILED;
  }
  if ((size_t)written != length) {
    return AUDIT_TRAIL_ERROR_WRITE_INCOMPLETE;
  }
  return fsync(descriptor) == 0 ? AUDIT_TRAIL_RESULT_OK
                                : AUDIT_TRAIL_ERROR_SYNC_FAILED;
}

static AuditTrailResultCode auditTrailAppend(
  const char *path, const AuditTrailEntry *entry
) {
  char                       line[AUDIT_TRAIL_ENTRY_CAPACITY];
  const AuditTrailResultCode formatted =
    auditTrailFormat(entry, line, sizeof(line));
  if (formatted != AUDIT_TRAIL_RESULT_OK) {
    return formatted;
  }

  /** No `O_TRUNC`: the trail is never shortened, whatever happens. */
  const int32_t descriptor = open(
    path, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, AUDIT_TRAIL_FILE_MODE
  );
  if (descriptor < 0) {
    return AUDIT_TRAIL_ERROR_OPEN_FAILED;
  }
  const AuditTrailResultCode written = auditTrailWrite(descriptor, line);
  close(descriptor);
  return written;
}

static AuditTrailResultCode auditTrailExtractAfter(
  const char   *line,
  const size_t  lineLength,
  const char   *what,
  char         *after,
  const size_t  afterCapacity
) {
  JsonToken             tokens[AUDIT_TRAIL_PARSE_TOKEN_CAPACITY];
  const JsonParseResult parsed =
    JsonI.parse(line, lineLength, tokens, AUDIT_TRAIL_PARSE_TOKEN_CAPACITY);
  if (parsed.code != JSON_RESULT_OK) {
    return AUDIT_TRAIL_ERROR_LINE_MALFORMED;
  }
  if (tokens[AUDIT_TRAIL_ROOT_TOKEN].kind != JSON_TOKEN_OBJECT) {
    return AUDIT_TRAIL_ERROR_LINE_NOT_AN_ENTRY;
  }
  const int32_t whatIndex = JsonI.findMember(
    line, tokens, parsed.tokenCount, AUDIT_TRAIL_ROOT_TOKEN, AUDIT_TRAIL_WHAT_KEY
  );
  const int32_t afterIndex = JsonI.findMember(
    line, tokens, parsed.tokenCount, AUDIT_TRAIL_ROOT_TOKEN, AUDIT_TRAIL_AFTER_KEY
  );
  if (whatIndex == JSON_NOT_FOUND || afterIndex == JSON_NOT_FOUND
      || !JsonI.equals(line, tokens, parsed.tokenCount, whatIndex, what)) {
    return AUDIT_TRAIL_ERROR_OTHER_CHANGE;
  }
  return JsonI.copyString(
           line, tokens, parsed.tokenCount, afterIndex, after, afterCapacity
         ) == JSON_RESULT_OK
         ? AUDIT_TRAIL_RESULT_OK
         : AUDIT_TRAIL_ERROR_AFTER_TOO_LONG;
}

static AuditTrailResultCode auditTrailReadLatestAfter(
  const char *path, const char *what, char *after, const size_t afterCapacity
) {
  FILE *trail = fopen(path, "r");
  if (trail == NULL) {
    return errno == ENOENT ? AUDIT_TRAIL_ERROR_NO_ENTRY
                           : AUDIT_TRAIL_ERROR_READ_FAILED;
  }
  char                 line[AUDIT_TRAIL_ENTRY_CAPACITY];
  AuditTrailResultCode latest = AUDIT_TRAIL_ERROR_NO_ENTRY;
  while (fgets(line, sizeof(line), trail) != NULL) {
    if (auditTrailExtractAfter(line, strlen(line), what, after, afterCapacity)
        == AUDIT_TRAIL_RESULT_OK) {
      latest = AUDIT_TRAIL_RESULT_OK;
    }
  }
  const bool failed = ferror(trail) != 0;
  fclose(trail);
  return failed ? AUDIT_TRAIL_ERROR_READ_FAILED : latest;
}

const struct AuditTrailType AuditTrailI = {
  .format            = auditTrailFormat,
  .append            = auditTrailAppend,
  .extractAfter      = auditTrailExtractAfter,
  .readLatestAfter   = auditTrailReadLatestAfter,
};
