import mqtt from 'mqtt';
import { randomBytes } from 'node:crypto';
import type { WakeupPublisher, WakeupFailure } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/** Public HiveMQ broker, reached over TLS (MQTT over TLS listens on 8883). */
export const WAKEUP_BROKER_URL = 'mqtts://broker.hivemq.com:8883';

/** How long to wait for the broker to accept a connection before giving up. */
export const WAKEUP_CONNECT_TIMEOUT_MS = 8_000;

/** How long to wait for the broker to acknowledge a publish (QoS 1) before giving up; a warm publish takes about 0.3 s, and a connection that died while the instance was paused only shows up as a missing acknowledgement. */
export const WAKEUP_PUBLISH_TIMEOUT_MS = 2_000;

/** How long `warmUp` leaves the broker alone after a failed connection, so an outage costs one attempt per period and not one per request; a publish still tries. */
export const WAKEUP_WARM_UP_RETRY_DELAY_MS = 30_000;

/**
 * Asks the platform to keep the instance running until `work` settles, so it is not paused
 * mid-connect. `work` never rejects: its failures are values.
 */
export type KeepAlive = (work: Promise<unknown>) => void;

/** Everything the publisher needs; there are no defaults. */
export interface MqttWakeupPublisherOptions {
  brokerUrl: string;
  keepAlive: KeepAlive;
  connectTimeoutMs: number;
  publishTimeoutMs: number;
  warmUpRetryDelayMs: number;
}

/** Why a connection is being opened, for the logs. */
type ConnectReason = 'warm-up' | 'publish' | 'reconnect';

/** One try of `publish`, for the logs. */
interface PublishAttempt {
  attempt: number;
  reason: ConnectReason;
  startedAt: number;
  reusedConnection: boolean;
}

/** What went wrong, as text for a Result's error and the logs. */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Publishes Wake-ups to the public MQTT broker: an empty payload, QoS 1, not retained, on a
 * clean session. One connection is kept per instance (a function instance on Vercel) and
 * reused while it stays open. `warmUp` opens it ahead of the first publish; a publish that
 * fails on a connection reconnects and retries once. Failures are returned, never thrown, and
 * the logs carry the instance id and timings, never topics, tokens or content.
 */
export class MqttWakeupPublisher implements WakeupPublisher {
  /** Random per instance, so instances never disconnect each other; short enough for MQTT 3.1 brokers. */
  private readonly instanceId = randomBytes(8).toString('hex');
  private client: mqtt.MqttClient | null = null;
  private connecting: Promise<Result<mqtt.MqttClient, WakeupFailure>> | null = null;
  private closed = false;
  /** When the last connection attempt failed (`performance.now()`), until one succeeds. */
  private lastConnectFailureAt: number | null = null;

  constructor(private readonly options: MqttWakeupPublisherOptions) {}

  /** Starts opening the connection when none is open or opening and the last attempt did not just fail, handing it to the keep-alive facility; failures are logged by `connect`. */
  warmUp(): void {
    if (this.connecting !== null || this.client?.connected === true) return;
    if (this.lastConnectFailureAt !== null && performance.now() - this.lastConnectFailureAt < this.options.warmUpRetryDelayMs) return;
    this.log('wakeup.broker.warm_up', {});
    this.options.keepAlive(this.connect('warm-up'));
  }

  /** Publishes on the open connection, opening one when needed, and retries once on a new connection when the publish fails. */
  async publish(topic: string): Promise<Result<void, WakeupFailure>> {
    const startedAt = performance.now();
    const first = await this.attemptPublish(topic, { attempt: 1, reason: 'publish', startedAt, reusedConnection: this.client?.connected === true });
    if (first.result.ok || first.client === null) return first.result;

    this.log('wakeup.broker.reconnect', { reason: first.result.error });
    await this.discard(first.client);
    const second = await this.attemptPublish(topic, { attempt: 2, reason: 'reconnect', startedAt, reusedConnection: false });
    return second.result;
  }

  /** Closes the connection, if any; for shutdown. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.client !== null) await this.discard(this.client);
  }

  /** The open connection, or the one being opened, or a new one. */
  private async connected(reason: ConnectReason): Promise<Result<mqtt.MqttClient, WakeupFailure>> {
    if (this.client?.connected === true) return ok(this.client);
    if (this.connecting !== null) return await this.connecting;
    return await this.connect(reason);
  }

  /** Opens a connection and remembers it; never rejects. */
  private connect(reason: ConnectReason): Promise<Result<mqtt.MqttClient, WakeupFailure>> {
    const startedAt = performance.now();
    const attempt = (async (): Promise<Result<mqtt.MqttClient, WakeupFailure>> => {
      try {
        const client = await mqtt.connectAsync(this.options.brokerUrl, {
          clientId: `pp-${this.instanceId}`,
          clean: true,
          reconnectPeriod: 0,
          connectTimeout: this.options.connectTimeoutMs
        });
        if (this.closed) {
          await this.end(client);
          return err('closed');
        }
        client.on('close', () => {
          if (this.client !== client) return;
          this.client = null;
          this.log('wakeup.broker.disconnected', {});
        });
        this.client = client;
        this.lastConnectFailureAt = null;
        this.log('wakeup.broker.connected', { reason, durationMs: Math.round(performance.now() - startedAt) });
        return ok(client);
      } catch (error) {
        const failure = reasonOf(error);
        this.lastConnectFailureAt = performance.now();
        this.log('wakeup.broker.connect_failed', { reason, failure, durationMs: Math.round(performance.now() - startedAt) });
        return err(failure);
      }
    })();
    this.connecting = attempt;
    void attempt.then(() => {
      if (this.connecting === attempt) this.connecting = null;
    });
    return attempt;
  }

  /** Publishes on `client` and waits for the broker's acknowledgement, up to the publish timeout. */
  private async publishOn(client: mqtt.MqttClient, topic: string): Promise<Result<void, WakeupFailure>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('publish timeout')), this.options.publishTimeoutMs);
    });
    try {
      await Promise.race([client.publishAsync(topic, '', { qos: 1, retain: false }), deadline]);
      return ok(undefined);
    } catch (error) {
      return err(reasonOf(error));
    } finally {
      clearTimeout(timer);
    }
  }

  /** Forgets `client`, if it is the current connection, and ends it. Another publish may already have replaced it. */
  private async discard(client: mqtt.MqttClient): Promise<void> {
    if (this.client === client) this.client = null;
    await this.end(client);
  }

  /** Ends `client` without waiting for in-flight messages. */
  private async end(client: mqtt.MqttClient): Promise<void> {
    try {
      await client.endAsync(true);
    } catch (error) {
      this.log('wakeup.broker.close_failed', { reason: reasonOf(error) });
    }
  }

  /** Connects if needed and publishes once, logging the outcome; `client` is the connection used, or null when none could be opened. */
  private async attemptPublish(topic: string, details: PublishAttempt): Promise<{ result: Result<void, WakeupFailure>; client: mqtt.MqttClient | null }> {
    const connected = await this.connected(details.reason);
    if (!connected.ok) {
      this.logPublish(connected, details);
      return { result: err(connected.error), client: null };
    }
    const published = await this.publishOn(connected.value, topic);
    this.logPublish(published, details);
    return { result: published, client: connected.value };
  }

  /** Logs the outcome and duration of a publish attempt. */
  private logPublish(result: Result<unknown, WakeupFailure>, details: PublishAttempt): void {
    this.log('wakeup.broker.publish', {
      ok: result.ok,
      ...(result.ok ? {} : { reason: result.error }),
      reusedConnection: details.reusedConnection,
      attempt: details.attempt,
      durationMs: Math.round(performance.now() - details.startedAt)
    });
  }

  /** One structured line; never topics, tokens or content. */
  private log(event: string, fields: Record<string, unknown>): void {
    console.log(JSON.stringify({ event, instanceId: this.instanceId, ...fields }));
  }
}
