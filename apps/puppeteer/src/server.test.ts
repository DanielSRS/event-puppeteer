import test from 'node:test';
import assert from 'node:assert/strict';
import { registerVerified, verificationTokenFor } from './test-support.ts';
import { createInMemoryIO } from './io/in-memory.ts';
import { createServer } from './server.ts';
import { loginHandler } from './handlers/auth.ts';
import { seedSuperadminHandler } from './handlers/seed.ts';

// Handler tests bypass Elysia; these go through the HTTP layer so response
// schema validation (and the OpenAPI plugin) is exercised too.
async function setup() {
  const io = await createInMemoryIO();
  const app = createServer(io);
  const org = await io.orgRepo.create({ name: 'Org', slug: 'org', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });
  const { token: adminToken, user: admin } = await registerVerified({ firstName: 'A', lastName: 'X', email: 'a@a.com', password: 'password123' }, org.id, io);
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

  return { io, orgId: org.id, adminToken, call };
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

  await t.test('update command requires a url and a sha256 digest', async () => {
    const { orgId, adminToken, call } = await setup();
    const { device } = (await call('POST', '/devices/connect', undefined, { identifier: 'mac-1', organizationId: orgId })).body;
    await call('POST', `/devices/${device.id}/approve`, adminToken, { name: 'D1', location: 'L1' });
    const send = (payload?: unknown) => call('POST', `/organizations/${orgId}/devices/${device.id}/commands`, adminToken,
      payload === undefined ? { type: 'update' } : { type: 'update', payload });
    const sha256 = 'a'.repeat(64);

    assert.equal((await send()).status, 422);
    assert.equal((await send({ url: '/releases/puppet' })).status, 422);
    assert.equal((await send({ url: '/releases/puppet', sha256: 'abc' })).status, 422);
    assert.equal((await send({ url: 'ftp://host/puppet', sha256 })).status, 422);

    const relative = await send({ url: '/releases/puppet', sha256, version: '1.2.0' });
    assert.equal(relative.status, 200);
    assert.deepEqual(relative.body.payload, { url: '/releases/puppet', sha256, version: '1.2.0' });
    assert.equal((await send({ url: 'https://cdn.example.com/puppet', sha256 })).status, 200);

    // Other command types keep a free-form, optional payload
    assert.equal((await call('POST', `/organizations/${orgId}/devices/${device.id}/commands`, adminToken, { type: 'custom', payload: { anything: 1 } })).status, 200);
  });

  await t.test('a new account logs in only after opening the emailed link', async () => {
    const { io, orgId, call } = await setup();
    const account = { firstName: 'N', lastName: 'U', email: 'new@a.com', password: 'password123' };

    const registered = await call('POST', `/auth/register?orgId=${orgId}`, undefined, account);
    assert.equal(registered.status, 200);
    assert.equal(registered.body.token, undefined);
    assert.equal((await call('POST', '/auth/register', undefined, { ...account, email: 'short@a.com', password: '1234567' })).status, 422);

    const blocked = await call('POST', '/auth/login', undefined, { email: account.email, password: account.password });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'Email not verified');

    const app = createServer(io, { appUrl: 'https://app.example.com/' });
    const invalid = await app.handle(new Request('http://localhost/auth/verify-email?token=nope'));
    assert.equal(invalid.headers.get('location'), 'https://app.example.com/login?emailVerified=0');

    const token = encodeURIComponent(verificationTokenFor(io, account.email));
    const verified = await app.handle(new Request(`http://localhost/auth/verify-email?token=${token}`));
    assert.equal(verified.status, 302);
    assert.equal(verified.headers.get('location'), 'https://app.example.com/login?emailVerified=1');

    const login = await call('POST', '/auth/login', undefined, { email: account.email, password: account.password });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    assert.equal((await call('POST', '/auth/login', undefined, { email: account.email, password: 'wrong-password' })).status, 401);
  });

  await t.test('GET /auth/me returns each User variant', async () => {
    const { io, orgId, adminToken, call } = await setup();
    await seedSuperadminHandler({ email: 'root@a.com', password: 'secret-123', firstName: 'S', lastName: 'A' }, io);
    const { token } = await loginHandler({ email: 'root@a.com', password: 'secret-123' }, io);

    const superadmin = await call('GET', '/auth/me', token);
    assert.equal(superadmin.status, 200);
    assert.equal(superadmin.body.role, 'Superadmin');
    assert.equal('organizationId' in superadmin.body, false);

    const admin = await call('GET', '/auth/me', adminToken);
    assert.equal(admin.status, 200);
    assert.equal(admin.body.role, 'Admin');
    assert.equal(admin.body.organizationId, orgId);
  });

  await t.test('every route except the public ones rejects anonymous requests', async () => {
    const { call } = await setup();
    // Public by decision: event listing (list, feed, details), what the TV display and the
    // event page read, plus the entry points that cannot require a login
    const isPublic = new Set([
      'GET /health',
      'POST /auth/register',
      'POST /auth/login',
      'GET /auth/verify-email',
      'POST /auth/resend-verification',
      'POST /devices/connect',
      'GET /organizations/{id}',
      'GET /organizations/{id}/feed',
      'GET /organizations/{id}/events/',
      'GET /organizations/{id}/events/{eventId}',
      'GET /tags/',
      'GET /link-labels/'
    ]);
    const spec = (await call('GET', '/openapi/json')).body;
    const exposed: string[] = [];
    for (const [path, methods] of Object.entries(spec.paths) as [string, Record<string, any>][]) {
      for (const [method, op] of Object.entries(methods)) {
        const route = `${method.toUpperCase()} ${path}`;
        if (isPublic.has(route)) continue;
        const res = await call(method.toUpperCase(), path.replace(/\{[^}]+\}/g, 'some-id'));
        // Body validation runs before the handler, so a route with a body may answer 422 first
        const rejected = res.status === 401 || (res.status === 422 && op.requestBody);
        if (!rejected) exposed.push(`${route} → ${res.status}`);
      }
    }
    assert.deepEqual(exposed, []);
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
