import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCheck } from './health.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('healthCheck returns status ok', async () => {
  const io = await createInMemoryIO();
  const request = new Request('http://localhost/health');
  
  const response = await healthCheck(request, io);
  
  assert.deepEqual(response, { status: 'ok' });
});
