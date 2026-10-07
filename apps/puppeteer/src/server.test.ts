import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryIO } from './io/in-memory.ts';
import { createServer } from './server.ts';
import { registerHandler } from './handlers/auth.ts';

// Handler tests bypass Elysia; these go through the HTTP layer so response
// schema validation (and the OpenAPI plugin) is exercised too.
async function setup() {
  const io = await createInMemoryIO();
  const app = createServer(io);
  const org = await io.orgRepo.create({ name: 'Org', slug: 'org', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });
  const { token: adminToken, user: admin } = await registerHandler({ firstName: 'A', lastName: 'X', email: 'a@a.com', password: '123' }, org.id, io);
  await io.userRepo.update(admin.id, { role: 'Admin' });

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.handle(new Request(`http://localhost${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    }));
    return { status: res.status, body: await res.json() as any };
  };

  return { orgId: org.id, adminToken, call };
}

test('HTTP layer', async (t) => {
  await t.test('device receives a command issued without payload', async () => {
    const { orgId, adminToken, call } = await setup();
    const connected = await call('POST', '/devices/connect', undefined, { identifier: 'mac-1', organizationId: orgId });
    const { device, token } = connected.body;
    assert.equal(device.tokenHash, undefined);

    await call('POST', `/devices/${device.id}/approve`, adminToken, { name: 'D1', location: 'L1' });
    const issued = await call('POST', `/organizations/${orgId}/devices/${device.id}/commands`, adminToken, { type: 'request_telemetry' });
    assert.equal(issued.status, 200);

    const pulled = await call('GET', `/devices/${device.id}/commands/pending`, token);
    assert.equal(pulled.status, 200);
    assert.equal(pulled.body.length, 1);
    assert.equal(pulled.body[0].type, 'request_telemetry');
    assert.equal(pulled.body[0].status, 'sent');
    assert.equal('payload' in pulled.body[0], false);

    const acked = await call('POST', `/devices/${device.id}/commands/${issued.body.id}/ack`, token);
    assert.equal(acked.status, 200);

    const listed = await call('GET', `/organizations/${orgId}/devices/${device.id}/commands`, adminToken);
    assert.equal(listed.status, 200);
    assert.equal(listed.body[0].status, 'acknowledged');
  });

  await t.test('OpenAPI spec documents every route', async () => {
    const { call } = await setup();
    const spec = await call('GET', '/openapi/json');
    assert.equal(spec.status, 200);
    const operations = Object.values(spec.body.paths).flatMap((methods: any) => Object.values(methods)) as any[];
    assert.ok(operations.length > 0);
    assert.deepEqual(operations.filter(op => !op.tags?.length || !op.summary), []);
  });
});
