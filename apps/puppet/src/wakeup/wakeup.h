/**
 * @file wakeup.h
 * @brief The Puppet's ear for Wake-ups: an MQTT subscription to the public broker.
 *
 * A Wake-up is an empty, one-way notice Puppeteer publishes to the topic
 * `<deviceId>/<organizationId>` (see `protocol.h`) whenever it stores a Command
 * for this Device. Hearing one is the Puppet's cue to fetch its Commands at
 * once instead of waiting for the next heartbeat. The broker is only an
 * accelerator: a missed Wake-up is reconciled by the heartbeat's
 * `commandsWaiting` flag, so nothing here may ever block or break the agent.
 *
 * This module is a thin shell around libmosquitto. It makes no decisions: it
 * reports what happened (`WakeupEvents`) and the schedule (`agent-schedule.h`)
 * decides what to do about it.
 *
 * ## Driving it from a single thread
 *
 * The agent loop is single-threaded, so the library's network loop is driven
 * from the outside:
 *
 * 1. `open` starts a non-blocking connection (the hostname lookup may still
 *    block briefly) and the subscription follows the broker's CONNACK.
 * 2. Wait on `descriptor` (and for writability while `wantsWrite`), at most
 *    about a second, then call `serve`: it connects, reads, writes and sends
 *    the keep-alive pings in one call.
 * 3. After each `serve` read `takeEvents`.
 * 4. `close` ends the connection and releases everything.
 *
 * Every session is clean: the broker keeps nothing for a Puppet that is gone,
 * so a restarted Puppet never replays stale Wake-ups.
 *
 * ## Broker settings
 *
 * Host, port and TLS are compile-time constants (see the CMake options and
 * `WakeupBrokerSettings`); the Puppet reads no environment variables for
 * them. With TLS on, the broker's certificate is verified against the
 * operating system's store.
 */
#ifndef PUPPET_WAKEUP_H_
#define PUPPET_WAKEUP_H_

#include "protocol/protocol.h"

#include <stdbool.h>
#include <stdint.h>

struct mosquitto;

/**
 * Seconds of silence after which the broker connection is probed. Public
 * brokers drop connections that are idle for much longer than this, and the
 * probe costs two tiny packets a minute.
 */
#define WAKEUP_KEEP_ALIVE_SECONDS ((int32_t)60)

/** Room for the library's description of why a connection was lost. */
#define WAKEUP_DESCRIPTION_CAPACITY ((size_t)96)

/** Where the broker is and how to talk to it. Borrowed, not copied. */
typedef struct {
  const char *host;
  int32_t     port;

  /** Encrypt the connection and verify the broker's certificate. */
  bool useTls;

  /** Seconds of silence after which the connection is probed (at least 5). */
  int32_t keepAliveSeconds;
} WakeupBrokerSettings;

typedef enum {
  WAKEUP_RESULT_OK = 0,

  /** The MQTT library could not be initialized. */
  WAKEUP_ERROR_LIBRARY_INITIALIZATION = 4101,
  /** The MQTT client could not be created. */
  WAKEUP_ERROR_CLIENT_CREATION = 4102,
  /** The TLS settings were refused by the library. */
  WAKEUP_ERROR_TLS_SETUP = 4103,
  /** The connection could not be started. */
  WAKEUP_ERROR_CONNECT = 4104,
  /** The subscription could not be requested. */
  WAKEUP_ERROR_SUBSCRIBE = 4105,
  /** The subscription could not be cancelled. */
  WAKEUP_ERROR_UNSUBSCRIBE = 4106,
  /** The Wake-up topic could not be built from the Device and Organization ids. */
  WAKEUP_ERROR_TOPIC = 4109,
  /** The library started connecting but holds no socket to wait on. */
  WAKEUP_ERROR_NO_SOCKET = 4110,

  /** `retarget` was called on a listener with no open connection. */
  WAKEUP_ERROR_RETARGET_NOT_OPEN = 4108,
  /** `serve` was called on a listener with no open connection. */
  WAKEUP_ERROR_SERVE_NOT_OPEN = 4111,

  /** Serving the connection failed; the loss is reported as an event. */
  WAKEUP_ERROR_SERVE = 4107,
} WakeupResultCode;

/** What happened since the previous `takeEvents`. */
typedef struct {
  /** At least one Wake-up arrived. */
  bool heard;

  /** The broker acknowledged the subscription of the current topic. */
  bool subscribed;

  /** The connection failed, was refused or was closed by the broker. */
  bool lost;

  /** Why, in the library's words; meaningful only when `lost`. */
  char lostDescription[WAKEUP_DESCRIPTION_CAPACITY];
} WakeupEvents;

/**
 * One connection to the broker. Create it with `WakeupListenerI.create`, never
 * by hand, and keep it at one address: the library holds a pointer to it.
 */
typedef struct {
  struct mosquitto *client;

  /** Topic the current subscription asks for. */
  char topic[PROTOCOL_WAKEUP_TOPIC_CAPACITY];

  /** The broker accepted the connection (CONNACK received). */
  bool accepted;

  /** Identifier of the subscription whose acknowledgement is awaited. */
  int32_t pendingSubscription;
  bool    awaitingSubscription;

  WakeupEvents events;
} WakeupListener;

struct WakeupListenerType {
  /**
   * Prepare the MQTT library. Call once, before the first listener and before
   * any other thread starts (the library is not thread safe here).
   */
  WakeupResultCode (*const initializeLibrary)(void);

  /** Release the library once every listener is closed. */
  void (*const shutdownLibrary)(void);

  /** A listener with no connection. */
  WakeupListener (*const create)(void);

  /**
   * Start connecting and subscribe to `topic` once the broker accepts.
   * Does not wait for the broker: success only means the attempt began. When
   * it fails, the next `takeEvents` carries the reason in `lostDescription`.
   *
   * @param listener  A closed listener (from `create`, or after `close`).
   */
  WakeupResultCode (*const open)(
    WakeupListener             *listener,
    const WakeupBrokerSettings *settings,
    const char                 *topic
  );

  /**
   * Move the subscription to `topic` on the open connection: the old topic is
   * left and the new one acknowledged by a later `subscribed` event.
   */
  WakeupResultCode (*const retarget)(WakeupListener *listener, const char *topic);

  /** The socket to wait on, or a negative value when there is none. */
  int32_t (*const descriptor)(const WakeupListener *listener);

  /** Whether data is queued to send, i.e. whether to wait for writability. */
  bool (*const wantsWrite)(const WakeupListener *listener);

  /**
   * Do whatever the connection needs now, without waiting: finish connecting
   * (including the TLS handshake), read what the broker sent, send what is
   * queued and keep the connection alive. Call it after every wait on
   * `descriptor`, and about once a second while open.
   *
   * The library's own loop does all of it in one call, and has to: its
   * separate read, write and housekeeping calls do not advance a connection
   * that is still being established.
   */
  WakeupResultCode (*const serve)(WakeupListener *listener);

  /** What happened since the last call; the record starts over. */
  WakeupEvents (*const takeEvents)(WakeupListener *listener);

  /** Disconnect and release the connection. Safe on a closed listener. */
  void (*const close)(WakeupListener *listener);
};

extern const struct WakeupListenerType WakeupListenerI;

#ifdef PUPPET_WAKEUP_IMPLEMENTATION
#include "wakeup.c"
#endif

#endif // PUPPET_WAKEUP_H_
