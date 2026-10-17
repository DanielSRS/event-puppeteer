import type { WakeupPublisher, WakeupFailure } from '../index.ts';
import { err, ok, type Result } from '../../utils/result.ts';

/**
 * Test double: records every Wake-up it is asked to publish so tests can inspect the topic and
 * delivery settings, and can be made to fail. Never wired in production.
 */
export class InMemoryWakeupPublisher implements WakeupPublisher {
  /** Every Wake-up published, in order, with the delivery settings it carried. */
  published: Array<{ topic: string; payload: string; qos: 1; retain: false }> = [];
  /** When set, publishing fails with this reason. */
  failure: WakeupFailure | null = null;

  async publish(topic: string): Promise<Result<void, WakeupFailure>> {
    if (this.failure !== null) return err(this.failure);
    this.published.push({ topic, payload: '', qos: 1, retain: false });
    return ok(undefined);
  }
}
