# Commands reach a Puppet through a Wake-up on a public MQTT broker, reconciled by the heartbeat

A Puppet used to poll for Commands every 10 s, which delays every Command by up to 10 s and makes Command polling about 360 of the 612 requests an idle Device sends per hour. We now publish an empty **Wake-up** to a public MQTT broker (HiveMQ) when a Command is stored. The Puppet fetches its Commands as soon as it hears one, so delivery takes well under a second. The heartbeat answer also carries `commandsWaiting`, which reconciles every missed Wake-up and replaces the Command poll entirely.

## Decisions

- **The Wake-up carries nothing.** The payload is empty, so the broker never sees a Command and a forged or replayed Wake-up costs one empty fetch. The Puppet still fetches Commands over authenticated HTTPS, and Puppeteer stays the source of truth for the ack/complete lifecycle and at-least-once delivery. Signing and encrypting richer messages is a later, separate decision.
- **Topic: `<deviceId>/<organizationId>`**, both full UUIDs. The broker is public and anyone can subscribe, so topics are not secret. Uniqueness comes from two independent random values that are already stored. A shared fixed prefix would be worse: the broker refuses wildcards in the first topic level, so a random first segment cannot be enumerated, while a known prefix could. The Puppet builds the topic from the `organizationId` it receives when approved, and resubscribes if that changes.
- **Delivery:** QoS 1, not retained, clean session, empty payload.
- **`commandsWaiting` in the heartbeat answer** is true while any Command is `pending` or `sent`. The Puppet fetches Commands only after a Wake-up, a true flag, or on boot and broker reconnect. A heartbeat answer without the field is an error: the Puppet logs it and treats the heartbeat as failed. Heartbeats stay at 20 s, which is the worst-case delay when MQTT fails.
- **Puppeteer's publisher** keeps one broker connection per function instance and starts it, without waiting, on every request, kept alive with `waitUntil`. A failed publish reconnects and retries once. If it still fails, the Command succeeds and the response reports `wakeup: { sent: false, reason }`, never an exception. An Admin can resend a Wake-up while the Command is `pending` or `sent`.
- **The Puppet uses libmosquitto**, polled from its single-threaded loop and linked statically, so the Device needs no MQTT library installed. Broker host, ports and TLS settings are compile-time constants, as in the Puppet's ADR-0001.
- **The Puppet logs broker loss and recovery once per change**, through the existing log queue. The Device is not marked `degraded`: it is on the slow path, not broken.
- **Rollout:** deploy Puppeteer first. The new field is additive, so Puppets already deployed ignore it and keep polling every 10 s until updated.

## Considered Options

- **Holding a connection on Vercel (long polling, SSE or WebSocket): rejected.** Hobby bills a fixed 2 GB of provisioned memory for as long as a request stays open, whatever the function really uses. On 2026-10-17 a one-hour hold test against the deployed Puppeteer added about 1.3 GB-hrs after roughly 40 minutes, matching 2 GB. One connected Puppet would use the 360 GB-hrs monthly allowance in about 7.5 days. Each connection is also capped at 300 s.
- **Polling faster:** a 1 s poll is about 2.6 million requests per month for one Device, against 1 million for the whole project.
- **Firebase Cloud Messaging:** has no working client for a C program on Linux. The C++ SDK's desktop Cloud Messaging is a stub.
- **Firebase Realtime Database streaming:** workable with libcurl, but capped at 100 simultaneous connections on the free plan. Rejected by the project owner.
- **A Cloudflare Durable Object with hibernating WebSockets:** a sound fit, but another platform and a WebSocket client on a Puppet whose libcurl (7.74) predates curl's WebSocket API. Not chosen.
- **Eclipse Paho C:** its asynchronous client runs its own thread, which breaks the single-threaded agent loop.
- **Connecting for every publish:** about 1.4 s measured from a developer machine (TLS handshake included), which alone breaks the sub-second goal. A warm connection publishes in about 0.3 s.

## Consequences

- A broker outage or throttle slows Commands to the heartbeat interval but cannot lose them, and the Puppet logs it.
- Anyone who learns a Device's topic can see when it receives Wake-ups or send it fake ones. The worst case is one extra authenticated fetch per fake. Putting Command content on the broker is out of scope until messages are signed and encrypted.
- The invocation allowance becomes the next ceiling: about 181,000 requests per Device per month at a 20 s heartbeat, so roughly 5 Devices on Hobby.
