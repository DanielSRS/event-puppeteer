import test from 'node:test';
import assert from 'node:assert/strict';
import { listOrgUsersHandler, assignRoleHandler, removeUserHandler } from './users.ts';
import { registerHandler } from './auth.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('Users Handlers & Roles', async (t) => {
  await t.test('search finds "José" when searching "jose" (accent-insensitive)', async () => {
    const io = await createInMemoryIO();
    const { token: adminToken } = await registerHandler({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: '123' }, 'org-1', io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    await registerHandler({ firstName: 'José', lastName: 'Silva', email: 'jose@a.com', password: '123' }, 'org-1', io);
    await registerHandler({ firstName: 'João', lastName: 'Souza', email: 'joao@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/?search=jose', { headers: { authorization: `Bearer ${adminToken}` } });
    const results = await listOrgUsersHandler(req, 'org-1', io);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.email, 'jose@a.com');
  });

  await t.test('search finds "MARIA" when searching "maria" (case-insensitive)', async () => {
    const io = await createInMemoryIO();
    const { token: adminToken } = await registerHandler({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: '123' }, 'org-1', io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    await registerHandler({ firstName: 'MARIA', lastName: 'SILVA', email: 'maria@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/?search=maria', { headers: { authorization: `Bearer ${adminToken}` } });
    const results = await listOrgUsersHandler(req, 'org-1', io);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.email, 'maria@a.com');
  });

  await t.test('Admin can change a user role', async () => {
    const io = await createInMemoryIO();
    const { token: adminToken } = await registerHandler({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: '123' }, 'org-1', io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    const { user: targetUser } = await registerHandler({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
    const updated = await assignRoleHandler(req, 'org-1', targetUser.id, { role: 'Moderator' }, io);
    
    assert.ok(updated);
    assert.equal(updated.role, 'Moderator');
  });

  await t.test('Member cannot change roles', async () => {
    const io = await createInMemoryIO();
    const { token: memberToken } = await registerHandler({ firstName: 'Member', lastName: 'X', email: 'm@a.com', password: '123' }, 'org-1', io);
    const { user: targetUser } = await registerHandler({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${memberToken}` } });
    await assert.rejects(
      assignRoleHandler(req, 'org-1', targetUser.id, { role: 'Moderator' }, io),
      /FORBIDDEN/
    );
  });

  await t.test('Superadmin can act on any organization', async () => {
    const io = await createInMemoryIO();
    const { token: superAdminToken } = await registerHandler({ firstName: 'Super', lastName: 'X', email: 's@a.com', password: '123' }, 'org-1', io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${superAdminToken}` } })))!, { role: 'Superadmin' });

    // Target is in org-2
    const { user: targetUser } = await registerHandler({ firstName: 'Target', lastName: 'Y', email: 't@b.com', password: '123' }, 'org-2', io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${superAdminToken}` } });
    const updated = await assignRoleHandler(req, 'org-2', targetUser.id, { role: 'Admin' }, io);
    
    assert.ok(updated);
    assert.equal(updated.role, 'Admin');
  });
});
