import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCheck } from './health.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('healthCheck returns status ok', async () => {
  const io = createInMemoryIO();
  const response = await healthCheck(null, io);
  assert.deepEqual(response, { status: 'ok' });
});
