import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import { requireAuth } from './users.ts';

/**
 * Longest a single hold may last, in seconds. Kept under Vercel's 300 s function
 * duration limit so the server, not the platform, ends the connection.
 */
export const MAX_HOLD_SECONDS = 290;

/** Seconds between the `tick` events written while a connection is held. */
const TICK_INTERVAL_SECONDS = 5;

/**
 * Identifies this process. Chained holds that report the same value ran on the same
 * Fluid compute instance.
 */
const INSTANCE_ID = randomUUID();

/** Moment this process started, in epoch milliseconds. */
const INSTANCE_STARTED_AT = Date.now();

/** Result of validating the requested hold duration. */
export type ParsedHoldSeconds =
  | { ok: true; seconds: number }
  | { ok: false; error: string };

/**
 * Validates the requested duration: a whole number of seconds from 1 to
 * {@link MAX_HOLD_SECONDS}. Nothing is clamped; an invalid value is an error.
 */
export function parseHoldSeconds(value: number): ParsedHoldSeconds {
  if (!Number.isInteger(value) || value < 1 || value > MAX_HOLD_SECONDS) {
    return { ok: false, error: `seconds must be a whole number from 1 to ${MAX_HOLD_SECONDS}` };
  }
  return { ok: true, seconds: value };
}

/**
 * Throwaway experiment: holds the request open as a server-sent event stream and ends
 * it by itself after `seconds`. Used to measure how Vercel bills Provisioned Memory
 * for a connection kept open. Superadmin only, so it cannot be used to burn the
 * monthly allowance. Remove once the measurement is recorded.
 *
 * Each `tick` event carries the instance identifier, its uptime and memory use, so the
 * client can tell whether chained holds shared one instance. The final `end` event
 * says why the stream closed.
 */
export async function holdTestHandler(request: Request, seconds: number, io: AppIO): Promise<Response> {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  const parsed = parseHoldSeconds(seconds);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;

  const event = (name: string, data: Record<string, unknown>) =>
    encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

  const snapshot = () => {
    const memory = process.memoryUsage();
    return {
      instanceId: INSTANCE_ID,
      instanceUptimeMs: Date.now() - INSTANCE_STARTED_AT,
      heldMs: Date.now() - startedAt,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed
    };
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(event('start', { ...snapshot(), requestedSeconds: parsed.seconds }));
      timer = setInterval(() => {
        const heldMs = Date.now() - startedAt;
        if (heldMs >= parsed.seconds * 1000) {
          clearInterval(timer);
          controller.enqueue(event('end', { ...snapshot(), reason: 'limit-reached' }));
          controller.close();
          return;
        }
        controller.enqueue(event('tick', snapshot()));
      }, TICK_INTERVAL_SECONDS * 1000);
      request.signal.addEventListener('abort', () => {
        clearInterval(timer);
      });
    },
    cancel() {
      clearInterval(timer);
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform'
    }
  });
}
