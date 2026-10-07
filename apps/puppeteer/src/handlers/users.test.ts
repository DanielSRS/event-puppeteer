import test from 'node:test';
import assert from 'node:assert/strict';
import { listOrgUsersHandler, assignRoleHandler, removeUserHandler } from './users.ts';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

async function setupTestOrgs(io: any) {
  const org1 = await io.orgRepo.create({ name: 'Org 1', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const org2 = await io.orgRepo.create({ name: 'Org 2', slug: 'org-2', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return { org1, org2 };
}

test('Users Handlers & Roles', async (t) => {
  await t.test('search finds "José" when searching "jose" (accent-insensitive)', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: adminToken } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    await registerVerified({ firstName: 'José', lastName: 'Silva', email: 'jose@a.com', password: 'password123' }, org1.id, io);
    await registerVerified({ firstName: 'João', lastName: 'Souza', email: 'joao@a.com', password: 'password123' }, org1.id, io);

    const req = new Request('http://localhost/?search=jose', { headers: { authorization: `Bearer ${adminToken}` } });
    const results = await listOrgUsersHandler(req, org1.id, io);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.email, 'jose@a.com');
  });

  await t.test('search finds "MARIA" when searching "maria" (case-insensitive)', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: adminToken } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    await registerVerified({ firstName: 'MARIA', lastName: 'SILVA', email: 'maria@a.com', password: 'password123' }, org1.id, io);

    const req = new Request('http://localhost/?search=maria', { headers: { authorization: `Bearer ${adminToken}` } });
    const results = await listOrgUsersHandler(req, org1.id, io);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.email, 'maria@a.com');
  });

  await t.test('Admin can change a user role', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: adminToken } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } })))!, { role: 'Admin' });

    const { user: targetUser } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
    const updated = await assignRoleHandler(req, org1.id, targetUser.id, { role: 'Moderator' }, io);
    
    assert.ok(updated);
    assert.equal(updated.role, 'Moderator');
  });

  await t.test('Member cannot change roles', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: memberToken } = await registerVerified({ firstName: 'Member', lastName: 'X', email: 'm@a.com', password: 'password123' }, org1.id, io);
    const { user: targetUser } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${memberToken}` } });
    await assert.rejects(
      assignRoleHandler(req, org1.id, targetUser.id, { role: 'Moderator' }, io),
      /FORBIDDEN/
    );
  });

  await t.test('Superadmin can act on any organization', async () => {
    const io = await createInMemoryIO();
    const { org1, org2 } = await setupTestOrgs(io);
    const { token: superAdminToken } = await registerVerified({ firstName: 'Super', lastName: 'X', email: 's@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update((await io.auth.getSessionUserId(new Request('http://localhost/', { headers: { authorization: `Bearer ${superAdminToken}` } })))!, { role: 'Superadmin' });

    // Target is in org2
    const { user: targetUser } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@b.com', password: 'password123' }, org2.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${superAdminToken}` } });
    const updated = await assignRoleHandler(req, org2.id, targetUser.id, { role: 'Admin' }, io);
    
    assert.ok(updated);
    assert.equal(updated.role, 'Admin');
  });
});
