import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHandler, loginHandler, meHandler } from './auth.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('Auth Handlers', async (t) => {
  await t.test('register user places them in correct org with Member role', async () => {
    const io = createInMemoryIO();
    const result = await registerHandler({
      firstName: 'José',
      lastName: 'Silva',
      email: 'jose@test.com',
      password: 'password123'
    }, 'org-123', io);

    assert.ok(result.token);
    assert.equal(result.user.organizationId, 'org-123');
    assert.equal(result.user.role, 'Member');
    assert.equal(result.user.normalizedName, 'jose silva');
  });

  await t.test('login with correct credentials succeeds', async () => {
    const io = createInMemoryIO();
    await registerHandler({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'pass' }, 'org-1', io);
    
    const session = await loginHandler({ email: 'a@b.com', password: 'pass' }, io);
    assert.ok(session.token);
  });

  await t.test('login with wrong credentials fails', async () => {
    const io = createInMemoryIO();
    await registerHandler({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'pass' }, 'org-1', io);
    
    await assert.rejects(
      loginHandler({ email: 'a@b.com', password: 'wrong' }, io),
      /Invalid credentials/
    );
  });

  await t.test('meHandler returns current user', async () => {
    const io = createInMemoryIO();
    const { token, user } = await registerHandler({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'pass' }, 'org-1', io);
    
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    const me = await meHandler(req, io);
    assert.equal(me.id, user.id);
  });
});
