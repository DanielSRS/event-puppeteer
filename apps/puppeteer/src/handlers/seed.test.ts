import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryIO } from '../io/in-memory.ts';
import { seedSuperadminHandler } from './seed.ts';
import { registerHandler, loginHandler, meHandler } from './auth.ts';

const input = { email: 'root@example.com', password: 'secret-123', firstName: 'Super', lastName: 'Admin' };

test('Superadmin seed', async (t) => {
  await t.test('creates a Superadmin without organization who can log in', async () => {
    const io = await createInMemoryIO();
    const result = await seedSuperadminHandler(input, io);

    assert.equal(result.status, 'created');
    assert.equal(result.user.role, 'Superadmin');
    assert.equal('organizationId' in result.user, false);
    assert.deepEqual(await io.orgRepo.getAll(), []);

    const { token } = await loginHandler({ email: input.email, password: input.password }, io);
    const me = await meHandler(new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } }), io);
    assert.equal(me.role, 'Superadmin');
    assert.equal('organizationId' in me, false);
  });

  await t.test('running it again changes nothing', async () => {
    const io = await createInMemoryIO();
    const first = await seedSuperadminHandler(input, io);
    const second = await seedSuperadminHandler(input, io);

    assert.equal(second.status, 'unchanged');
    assert.equal(second.user.id, first.user.id);
  });

  await t.test('promotes an existing user with that email', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });
    const { user } = await registerHandler({ firstName: 'M', lastName: 'X', email: input.email, password: 'password123' }, org.id, io);

    const result = await seedSuperadminHandler(input, io);

    assert.equal(result.status, 'promoted');
    assert.equal(result.user.id, user.id);
    assert.equal((await io.userRepo.getById(user.id))?.role, 'Superadmin');
  });
});
