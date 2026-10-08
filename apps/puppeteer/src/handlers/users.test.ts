import test from 'node:test';
import assert from 'node:assert/strict';
import { listOrgUsersHandler, assignRoleHandler, removeUserHandler } from './users.ts';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { createEventHandler, listEventsHandler } from './events.ts';
import { eventFeedHandler } from './feed.ts';
import { voteHandler } from './votes.ts';
import { reportEventHandler, listShadowBansHandler, listAuditTrailHandler } from './moderation.ts';
import { loginHandler, meHandler } from './auth.ts';

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
  await t.test('removing a User with events, votes and reports deactivates them and keeps the audit trail', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: adminToken, user: admin } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update(admin.id, { role: 'Admin' });
    const { token: targetToken, user: target } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);
    const adminReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
    const targetReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${targetToken}` } });

    const own = await createEventHandler(targetReq, org1.id, {
      title: 'Target event', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);
    const adminEvent = await createEventHandler(adminReq, org1.id, {
      title: 'Admin event', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);
    await voteHandler(targetReq, org1.id, adminEvent.id, io);
    await reportEventHandler(targetReq, org1.id, adminEvent.id, { reason: 'spam' }, io);
    await reportEventHandler(adminReq, org1.id, own.id, { reason: 'spam' }, io);

    await removeUserHandler(adminReq, org1.id, target.id, io);

    assert.deepEqual((await listOrgUsersHandler(adminReq, org1.id, io)).map(u => u.id), [admin.id]);
    const searchReq = new Request('http://localhost/?search=target', { headers: { authorization: `Bearer ${adminToken}` } });
    assert.deepEqual(await listOrgUsersHandler(searchReq, org1.id, io), []);

    assert.deepEqual((await listEventsHandler(adminReq, org1.id, io)).map(e => e.id), [adminEvent.id]);
    assert.deepEqual((await eventFeedHandler(org1.id, io)).map(e => e.id), [adminEvent.id]);
    assert.equal((await io.eventRepo.getById(own.id))?.isDeleted, true);

    await assert.rejects(meHandler(targetReq, io), /UNAUTHORIZED/);
    await assert.rejects(voteHandler(targetReq, org1.id, adminEvent.id, io), /UNAUTHORIZED/);
    await assert.rejects(loginHandler({ email: 't@a.com', password: 'password123' }, io), /INVALID_CREDENTIALS/);

    const audit = await listAuditTrailHandler(adminReq, org1.id, io);
    const entry = audit.find(a => a.action === 'remove_user');
    assert.ok(entry);
    assert.equal(entry.actorId, admin.id);
    assert.equal(entry.targetType, 'user');
    assert.equal(entry.targetId, target.id);
    assert.deepEqual(entry.details, { deletedEvents: 1 });

    await assert.rejects(removeUserHandler(adminReq, org1.id, target.id, io), /NOT_FOUND/);
  });

  await t.test('a removed User no longer appears among shadow-banned Users', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token: adminToken, user: admin } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update(admin.id, { role: 'Admin' });
    const { user: target } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update(target.id, { isShadowBanned: true });
    const adminReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal((await listShadowBansHandler(adminReq, org1.id, io)).length, 1);

    await removeUserHandler(adminReq, org1.id, target.id, io);

    assert.deepEqual(await listShadowBansHandler(adminReq, org1.id, io), []);
  });

  await t.test('a removed User is rejected even while their session still exists', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token, user } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    assert.equal(await io.userRepo.markRemoved(user.id, new Date()), true);

    assert.equal(await io.auth.getSessionUserId(req), user.id);
    await assert.rejects(meHandler(req, io), /UNAUTHORIZED/);
    await assert.rejects(listOrgUsersHandler(req, org1.id, io), /UNAUTHORIZED/);
  });

  await t.test('an Admin cannot remove themselves', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token, user } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, org1.id, io);
    await io.userRepo.update(user.id, { role: 'Admin' });
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    await assert.rejects(removeUserHandler(req, org1.id, user.id, io), /BAD_REQUEST/);
    assert.equal((await io.userRepo.getById(user.id))?.id, user.id);
  });

  await t.test('a Member cannot remove Users', async () => {
    const io = await createInMemoryIO();
    const { org1 } = await setupTestOrgs(io);
    const { token } = await registerVerified({ firstName: 'Member', lastName: 'X', email: 'm@a.com', password: 'password123' }, org1.id, io);
    const { user: target } = await registerVerified({ firstName: 'Target', lastName: 'Y', email: 't@a.com', password: 'password123' }, org1.id, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    await assert.rejects(removeUserHandler(req, org1.id, target.id, io), /FORBIDDEN/);
    assert.equal((await io.userRepo.getById(target.id))?.id, target.id);
  });
});
