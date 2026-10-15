#include "audit-trail.h"

#include "json/json.h"

#include <fcntl.h>
#include <stdbool.h>
#include <string.h>
#include <sys/file.h>
#include <unistd.h>

/** Readable by whoever administers the Device, writable only by its owner. */
#define AUDIT_TRAIL_FILE_MODE ((mode_t)0644)

#define AUDIT_TRAIL_ENTRY_TERMINATOR '\n'

/** The terminator and the null character that follow the JSON object. */
#define AUDIT_TRAIL_SUFFIX_LENGTH ((size_t)2)

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
  JsonWriterI.key(&writer, "what");
  JsonWriterI.string(&writer, entry->what);
  JsonWriterI.key(&writer, "before");
  JsonWriterI.string(&writer, entry->before);
  JsonWriterI.key(&writer, "after");
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

const struct AuditTrailType AuditTrailI = {
  .format = auditTrailFormat,
  .append = auditTrailAppend,
};
