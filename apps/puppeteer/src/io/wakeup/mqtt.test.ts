import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import mqtt from 'mqtt';
import { Aedes } from 'aedes';
import { MqttWakeupPublisher } from './mqtt.ts';

/** A real MQTT broker on a free local port, with the ids of the connections it accepted. */
async function startBroker() {
  const aedes = await Aedes.createBroker();
  const server: Server = createServer(aedes.handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const connections: Array<{ clientId: string; close: () => void }> = [];
  aedes.on('client', (client) => connections.push({ clientId: client.id, close: () => client.close() }));
  const url = `mqtt://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const stop = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => aedes.close(() => resolve()));
  };
  return { aedes, url, connections, stop };
}

/** Subscribes to `topic` and collects what the broker delivers. */
async function listen(url: string, topic: string) {
  const client = await mqtt.connectAsync(url, { clean: true, reconnectPeriod: 0 });
  const received: Array<{ payload: string; qos: number; retain: boolean }> = [];
  client.on('message', (_topic, payload, packet) => received.push({ payload: payload.toString(), qos: packet.qos, retain: packet.retain }));
  await client.subscribeAsync(topic, { qos: 1 });
  return { received, stop: () => client.endAsync(true) };
}

/** Waits until `condition` holds, or fails the test after two seconds. */
async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, 'condition not reached in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Authorization handler that never calls back, so the broker never sends a PUBACK. */
function neverAnswer(): void {}

/** Collects the work handed to the keep-alive facility. */
function keepAliveRecorder() {
  const kept: Array<Promise<unknown>> = [];
  return { kept, keepAlive: (work: Promise<unknown>) => { kept.push(work); } };
}

/** Runs `run` with `console.log`/`console.warn` captured as parsed structured lines. */
async function captureLogs(run: () => Promise<void>): Promise<Array<Record<string, unknown>>> {
  const lines: string[] = [];
  const { log, warn } = console;
  console.log = (line: unknown) => { lines.push(String(line)); };
  console.warn = (line: unknown) => { lines.push(String(line)); };
  try {
    await run();
  } finally {
    console.log = log;
    console.warn = warn;
  }
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** A publisher for the broker at `url`, with short timeouts so failures show up quickly. */
function publisherFor(url: string, keepAlive: (work: Promise<unknown>) => void, publishTimeoutMs = 2000, warmUpRetryDelayMs = 0) {
  return new MqttWakeupPublisher({ brokerUrl: url, keepAlive, connectTimeoutMs: 1000, publishTimeoutMs, warmUpRetryDelayMs });
}

test('MqttWakeupPublisher', async (t) => {
  await t.test('publishes an empty, QoS 1, non-retained message to the topic', async () => {
    const broker = await startBroker();
    const topic = 'device-1/org-1';
    const subscriber = await listen(broker.url, topic);
    const publisher = publisherFor(broker.url, keepAliveRecorder().keepAlive);

    const result = await publisher.publish(topic);

    assert.equal(result.ok, true);
    await until(() => subscriber.received.length === 1);
    assert.deepEqual(subscriber.received, [{ payload: '', qos: 1, retain: false }]);
    await publisher.close();
    await subscriber.stop();
    await broker.stop();
  });

  await t.test('warmUp starts connecting without waiting and hands the connect to the keep-alive facility', async () => {
    const broker = await startBroker();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);

    const returned: unknown = publisher.warmUp();

    assert.equal(returned, undefined);
    assert.equal(kept.length, 1);
    assert.equal(broker.connections.length, 0);
    await kept[0];
    assert.equal(broker.connections.length, 1);
    await publisher.close();
    await broker.stop();
  });

  await t.test('a warm instance publishes without reconnecting, and warming again while warm starts nothing', async () => {
    const broker = await startBroker();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);
    publisher.warmUp();
    await kept[0];

    publisher.warmUp();
    assert.equal(kept.length, 1);
    assert.equal((await publisher.publish('a/b')).ok, true);
    assert.equal((await publisher.publish('a/b')).ok, true);

    assert.equal(broker.connections.length, 1);
    await publisher.close();
    await broker.stop();
  });

  await t.test('warming while a connect is already in flight starts nothing', async () => {
    const broker = await startBroker();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);

    publisher.warmUp();
    publisher.warmUp();

    assert.equal(kept.length, 1);
    await kept[0];
    assert.equal(broker.connections.length, 1);
    await publisher.close();
    await broker.stop();
  });

  await t.test('a connection the broker dropped is replaced by the next publish', async () => {
    const broker = await startBroker();
    const subscriber = await listen(broker.url, 'a/b');
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);
    publisher.warmUp();
    await kept[0];
    const dropped = broker.connections.find((connection) => connection.clientId.startsWith('pp-'));
    assert.ok(dropped);
    dropped.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await publisher.publish('a/b');

    assert.equal(result.ok, true);
    await until(() => subscriber.received.length === 1);
    assert.equal(broker.connections.filter((connection) => connection.clientId.startsWith('pp-')).length, 2);
    await publisher.close();
    await subscriber.stop();
    await broker.stop();
  });

  await t.test('a publish the broker never acknowledges reconnects and retries once, then reports the failure as a value', async () => {
    const broker = await startBroker();
    broker.aedes.authorizePublish = neverAnswer;
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive, 200);
    publisher.warmUp();
    await kept[0];

    const result = await publisher.publish('a/b');

    assert.equal(result.ok, false);
    assert.equal(broker.connections.filter((connection) => connection.clientId.startsWith('pp-')).length, 2);
    await publisher.close();
    await broker.stop();
  });

  await t.test('an unreachable broker makes publish report a failure while the warm-up never rejects', async () => {
    const broker = await startBroker();
    const url = broker.url;
    await broker.stop();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(url, keepAlive);

    publisher.warmUp();
    await assert.doesNotReject(kept[0]!);
    const result = await publisher.publish('a/b');

    assert.equal(result.ok, false);
    if (!result.ok) assert.notEqual(result.error, '');
    await publisher.close();
  });

  await t.test('after a failed connection, warming again within the retry delay starts nothing, and a publish still tries', async () => {
    const broker = await startBroker();
    const url = broker.url;
    await broker.stop();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(url, keepAlive, 2000, 60_000);

    publisher.warmUp();
    await kept[0]!;
    publisher.warmUp();
    const result = await publisher.publish('a/b');

    assert.equal(kept.length, 1);
    assert.equal(result.ok, false);
    await publisher.close();
  });

  await t.test('concurrent publishes that fail on the same connection share one reconnect', async () => {
    const broker = await startBroker();
    const subscriber = await listen(broker.url, 'a/b');
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive, 300);
    publisher.warmUp();
    await kept[0];
    let swallowing = true;
    broker.aedes.authorizePublish = (client, packet, callback) => {
      if (swallowing) return;
      callback(null);
    };
    setTimeout(() => { swallowing = false; }, 100);

    const results = await Promise.all([publisher.publish('a/b'), publisher.publish('a/b')]);

    assert.deepEqual(results.map((result) => result.ok), [true, true]);
    assert.equal(broker.connections.filter((connection) => connection.clientId.startsWith('pp-')).length, 2);
    await until(() => subscriber.received.length === 2);
    await publisher.close();
    await subscriber.stop();
    await broker.stop();
  });

  await t.test('a connect that finishes after close leaves nothing open', async () => {
    const broker = await startBroker();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);

    publisher.warmUp();
    await publisher.close();
    await kept[0];
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(broker.aedes.connectedClients, 0);
    await broker.stop();
  });

  await t.test('each instance connects with its own random client id', async () => {
    const broker = await startBroker();
    const first = publisherFor(broker.url, keepAliveRecorder().keepAlive);
    const second = publisherFor(broker.url, keepAliveRecorder().keepAlive);

    await first.publish('a/b');
    await second.publish('a/b');

    const ids = broker.connections.map((connection) => connection.clientId);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    for (const id of ids) assert.match(id, /^pp-[0-9a-f]{16}$/);
    await first.close();
    await second.close();
    await broker.stop();
  });

  await t.test('logs warm-up, connect duration, publish outcome and duration with the instance id and nothing else', async () => {
    const broker = await startBroker();
    const { kept, keepAlive } = keepAliveRecorder();
    const publisher = publisherFor(broker.url, keepAlive);

    const entries = await captureLogs(async () => {
      publisher.warmUp();
      await kept[0];
      await publisher.publish('device-secret-topic/org');
    });

    const byEvent = (event: string) => entries.filter((entry) => entry.event === event);
    assert.equal(byEvent('wakeup.broker.warm_up').length, 1);
    const connected = byEvent('wakeup.broker.connected');
    assert.equal(connected.length, 1);
    assert.equal(typeof connected[0]!.durationMs, 'number');
    const published = byEvent('wakeup.broker.publish');
    assert.equal(published.length, 1);
    assert.equal(published[0]!.ok, true);
    assert.equal(published[0]!.reusedConnection, true);
    assert.equal(typeof published[0]!.durationMs, 'number');
    const instanceIds = new Set(entries.map((entry) => entry.instanceId));
    assert.equal(instanceIds.size, 1);
    assert.match(String([...instanceIds][0]), /^[0-9a-f]{16}$/);
    assert.equal(JSON.stringify(entries).includes('device-secret-topic'), false);
    await publisher.close();
    await broker.stop();
  });

  await t.test('logs the reason for a reconnect', async () => {
    const broker = await startBroker();
    broker.aedes.authorizePublish = neverAnswer;
    const publisher = publisherFor(broker.url, keepAliveRecorder().keepAlive, 200);

    const entries = await captureLogs(async () => {
      await publisher.publish('a/b');
    });

    const reconnects = entries.filter((entry) => entry.event === 'wakeup.broker.reconnect');
    assert.equal(reconnects.length, 1);
    assert.equal(reconnects[0]!.reason, 'publish timeout');
    await publisher.close();
    await broker.stop();
  });
});
