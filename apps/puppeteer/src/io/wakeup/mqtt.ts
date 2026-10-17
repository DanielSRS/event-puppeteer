import mqtt from 'mqtt';
import type { WakeupPublisher, WakeupFailure } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/** Public HiveMQ broker, reached over TLS (MQTT over TLS listens on 8883). */
export const WAKEUP_BROKER_URL = 'mqtts://broker.hivemq.com:8883';

/** How long to wait for the broker to accept the connection before giving up. */
const CONNECT_TIMEOUT_MS = 8_000;

/** How long to wait for the broker to acknowledge the publish (QoS 1) before giving up. */
const PUBLISH_TIMEOUT_MS = 5_000;

/**
 * Publishes Wake-ups to the public MQTT broker: an empty payload, QoS 1, not retained, on a
 * clean session. This first version connects for every publish and closes afterwards.
 */
export class MqttWakeupPublisher implements WakeupPublisher {
  constructor(private brokerUrl: string) {}

  async publish(topic: string): Promise<Result<void, WakeupFailure>> {
    let client: mqtt.MqttClient | null = null;
    try {
      client = await mqtt.connectAsync(this.brokerUrl, {
        clean: true,
        reconnectPeriod: 0,
        connectTimeout: CONNECT_TIMEOUT_MS
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('publish timeout')), PUBLISH_TIMEOUT_MS);
      });
      try {
        await Promise.race([client.publishAsync(topic, '', { qos: 1, retain: false }), deadline]);
      } finally {
        clearTimeout(timer);
      }
      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    } finally {
      if (client !== null) {
        try {
          await client.endAsync(true);
        } catch (error) {
          console.warn(JSON.stringify({ event: 'wakeup.close_failed', reason: error instanceof Error ? error.message : String(error) }));
        }
      }
    }
  }
}
