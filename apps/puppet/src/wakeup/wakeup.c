#include "wakeup.h"

#include <mosquitto.h>

#include <stdio.h>
#include <string.h>

/**
 * The subscription is QoS 1 to match what Puppeteer publishes: a Wake-up
 * published while this connection is up is delivered at least once.
 */
#define WAKEUP_SUBSCRIPTION_QOS ((int32_t)1)

/** Packets handled per read or write call; the library documents it as unused, one for forward compatibility. */
#define WAKEUP_LOOP_MAX_PACKETS ((int32_t)1)

/** What `wakeupDescriptor` answers when there is no connection. */
#define WAKEUP_NO_DESCRIPTOR ((int32_t)-1)

/** Value that turns on `MOSQ_OPT_TLS_USE_OS_CERTS`: trust the operating system's certificate store. */
#define WAKEUP_TLS_USE_OS_CERTIFICATES ((int32_t)1)

/** `SSL_VERIFY_PEER`: abort the connection when the certificate does not verify. */
#define WAKEUP_TLS_VERIFY_PEER ((int32_t)1)

/** The subscription acknowledgement's value for "the broker refused it". */
#define WAKEUP_SUBSCRIPTION_REFUSED ((int32_t)0x80)

static WakeupEvents wakeupNoEvents(void) {
  return (WakeupEvents){
    .heard             = false,
    .subscribed        = false,
    .lost              = false,
    .lostDescription   = "",
  };
}

static void wakeupReportLost(WakeupListener *listener, const char *description) {
  /** Only the first loss of a connection counts; what follows is its echo. */
  if (listener->events.lost) {
    return;
  }
  listener->events.lost = true;
  snprintf(
    listener->events.lostDescription,
    sizeof(listener->events.lostDescription),
    "%s",
    description
  );
}

static void wakeupReportLibraryError(WakeupListener *listener, const int32_t code) {
  wakeupReportLost(listener, mosquitto_strerror((int)code));
}

static WakeupResultCode wakeupSubscribe(WakeupListener *listener) {
  int subscription = 0;
  const int result = mosquitto_subscribe(
    listener->client,
    &subscription,
    listener->topic,
    (int)WAKEUP_SUBSCRIPTION_QOS
  );
  if (result != MOSQ_ERR_SUCCESS) {
    wakeupReportLibraryError(listener, (int32_t)result);
    return WAKEUP_ERROR_SUBSCRIBE;
  }
  listener->pendingSubscription  = subscription;
  listener->awaitingSubscription = true;
  return WAKEUP_RESULT_OK;
}

static void wakeupOnConnect(struct mosquitto *client, void *userdata, const int result) {
  (void)client;
  WakeupListener *listener = userdata;
  if (result != MOSQ_ERR_SUCCESS) {
    wakeupReportLost(listener, mosquitto_connack_string(result));
    return;
  }
  listener->accepted = true;
  if (wakeupSubscribe(listener) != WAKEUP_RESULT_OK) {
    /** The failed request already reported the loss (see `wakeupSubscribe`). */
    return;
  }
}

static void wakeupOnSubscribe(
  struct mosquitto *client,
  void             *userdata,
  const int         subscription,
  const int         grantedCount,
  const int        *grantedQualities
) {
  (void)client;
  WakeupListener *listener = userdata;
  if (!listener->awaitingSubscription || subscription != listener->pendingSubscription) {
    return;
  }
  listener->awaitingSubscription = false;
  if (grantedCount < 1 || grantedQualities[0] >= WAKEUP_SUBSCRIPTION_REFUSED) {
    wakeupReportLost(listener, "the broker refused the subscription");
    return;
  }
  listener->events.subscribed = true;
}

static void wakeupOnMessage(
  struct mosquitto *client, void *userdata, const struct mosquitto_message *message
) {
  (void)client;
  (void)message;
  /** The subscription names exactly one topic and a Wake-up carries no
   *  payload, so any message is the Wake-up. */
  WakeupListener *listener = userdata;
  listener->events.heard = true;
}

static void wakeupOnDisconnect(struct mosquitto *client, void *userdata, const int result) {
  (void)client;
  /** Zero means this Puppet disconnected on purpose. */
  if (result != MOSQ_ERR_SUCCESS) {
    wakeupReportLibraryError(userdata, result);
  }
}

static WakeupResultCode wakeupInitializeLibrary(void) {
  return mosquitto_lib_init() == MOSQ_ERR_SUCCESS
         ? WAKEUP_RESULT_OK
         : WAKEUP_ERROR_LIBRARY_INITIALIZATION;
}

static void wakeupShutdownLibrary(void) {
  mosquitto_lib_cleanup();
}

static WakeupListener wakeupCreate(void) {
  return (WakeupListener){
    .client               = NULL,
    .topic                = "",
    .accepted             = false,
    .pendingSubscription  = 0,
    .awaitingSubscription = false,
    .events               = wakeupNoEvents(),
  };
}

static void wakeupClose(WakeupListener *listener) {
  if (listener->client != NULL) {
    mosquitto_disconnect(listener->client);
    mosquitto_destroy(listener->client);
  }
  *listener = wakeupCreate();
}

static WakeupResultCode wakeupConfigureTls(struct mosquitto *client) {
  /** The operating system's store is the one place trust is managed on a
   *  Device, as for libcurl. */
  const bool configured =
    mosquitto_int_option(client, MOSQ_OPT_TLS_USE_OS_CERTS, (int)WAKEUP_TLS_USE_OS_CERTIFICATES) == MOSQ_ERR_SUCCESS
    && mosquitto_tls_opts_set(client, (int)WAKEUP_TLS_VERIFY_PEER, NULL, NULL)
         == MOSQ_ERR_SUCCESS;
  return configured ? WAKEUP_RESULT_OK : WAKEUP_ERROR_TLS_SETUP;
}

static WakeupResultCode wakeupOpen(
  WakeupListener             *listener,
  const WakeupBrokerSettings *settings,
  const char                 *topic
) {
  *listener = wakeupCreate();
  snprintf(listener->topic, sizeof(listener->topic), "%s", topic);

  /** A clean session: the broker keeps nothing for a Puppet that is gone. */
  struct mosquitto *client = mosquitto_new(NULL, true, listener);
  if (client == NULL) {
    wakeupReportLost(listener, "the MQTT client could not be created");
    return WAKEUP_ERROR_CLIENT_CREATION;
  }
  mosquitto_connect_callback_set(client, wakeupOnConnect);
  mosquitto_subscribe_callback_set(client, wakeupOnSubscribe);
  mosquitto_message_callback_set(client, wakeupOnMessage);
  mosquitto_disconnect_callback_set(client, wakeupOnDisconnect);

  if (settings->useTls && wakeupConfigureTls(client) != WAKEUP_RESULT_OK) {
    mosquitto_destroy(client);
    wakeupReportLost(listener, "the TLS settings were refused");
    return WAKEUP_ERROR_TLS_SETUP;
  }

  /**
   * The loop is driven from the agent's thread, never from the library's.
   * The library documents `mosquitto_connect_async` for its own loop thread,
   * but it starts the non-blocking connection and opens the socket right away
   * (libmosquitto 2.0.11 and later), which is what a hand-driven loop needs;
   * the check below turns any version that does otherwise into a visible failure.
   */
  const int connectResult = mosquitto_connect_async(
    client, settings->host, (int)settings->port, (int)settings->keepAliveSeconds
  );
  if (connectResult != MOSQ_ERR_SUCCESS) {
    mosquitto_destroy(client);
    wakeupReportLibraryError(listener, connectResult);
    return WAKEUP_ERROR_CONNECT;
  }
  if (mosquitto_socket(client) == WAKEUP_NO_DESCRIPTOR) {
    mosquitto_destroy(client);
    wakeupReportLost(listener, "the MQTT library opened no socket");
    return WAKEUP_ERROR_NO_SOCKET;
  }
  listener->client = client;
  return WAKEUP_RESULT_OK;
}

static WakeupResultCode wakeupRetarget(WakeupListener *listener, const char *topic) {
  if (listener->client == NULL) {
    return WAKEUP_ERROR_RETARGET_NOT_OPEN;
  }
  char previous[PROTOCOL_WAKEUP_TOPIC_CAPACITY];
  snprintf(previous, sizeof(previous), "%s", listener->topic);
  snprintf(listener->topic, sizeof(listener->topic), "%s", topic);

  /** Before the broker accepts, `wakeupOnConnect` subscribes to the new topic. */
  if (!listener->accepted) {
    return WAKEUP_RESULT_OK;
  }
  if (mosquitto_unsubscribe(listener->client, NULL, previous) != MOSQ_ERR_SUCCESS) {
    return WAKEUP_ERROR_UNSUBSCRIBE;
  }
  return wakeupSubscribe(listener);
}

static int32_t wakeupDescriptor(const WakeupListener *listener) {
  return listener->client == NULL ? WAKEUP_NO_DESCRIPTOR : (int32_t)mosquitto_socket(listener->client);
}

static bool wakeupWantsWrite(const WakeupListener *listener) {
  return listener->client != NULL && mosquitto_want_write(listener->client);
}

static WakeupResultCode wakeupServed(
  WakeupListener         *listener,
  const int32_t           result,
  const WakeupResultCode  failure
) {
  if (result == MOSQ_ERR_SUCCESS) {
    return WAKEUP_RESULT_OK;
  }
  wakeupReportLibraryError(listener, result);
  return failure;
}

static WakeupResultCode wakeupHandleReadable(WakeupListener *listener) {
  if (listener->client == NULL) {
    return WAKEUP_ERROR_READ_NOT_OPEN;
  }
  return wakeupServed(
    listener,
    (int32_t)mosquitto_loop_read(listener->client, (int)WAKEUP_LOOP_MAX_PACKETS),
    WAKEUP_ERROR_READ
  );
}

static WakeupResultCode wakeupHandleWritable(WakeupListener *listener) {
  if (listener->client == NULL) {
    return WAKEUP_ERROR_WRITE_NOT_OPEN;
  }
  return wakeupServed(
    listener,
    (int32_t)mosquitto_loop_write(listener->client, (int)WAKEUP_LOOP_MAX_PACKETS),
    WAKEUP_ERROR_WRITE
  );
}

static WakeupResultCode wakeupMaintain(WakeupListener *listener) {
  if (listener->client == NULL) {
    return WAKEUP_ERROR_MAINTAIN_NOT_OPEN;
  }
  return wakeupServed(
    listener, (int32_t)mosquitto_loop_misc(listener->client), WAKEUP_ERROR_MAINTAIN
  );
}

static WakeupEvents wakeupTakeEvents(WakeupListener *listener) {
  const WakeupEvents taken = listener->events;
  listener->events         = wakeupNoEvents();
  return taken;
}

const struct WakeupListenerType WakeupListenerI = {
  .initializeLibrary = wakeupInitializeLibrary,
  .shutdownLibrary   = wakeupShutdownLibrary,
  .create            = wakeupCreate,
  .open              = wakeupOpen,
  .retarget          = wakeupRetarget,
  .descriptor        = wakeupDescriptor,
  .wantsWrite        = wakeupWantsWrite,
  .handleReadable    = wakeupHandleReadable,
  .handleWritable    = wakeupHandleWritable,
  .maintain          = wakeupMaintain,
  .takeEvents        = wakeupTakeEvents,
  .close             = wakeupClose,
};
