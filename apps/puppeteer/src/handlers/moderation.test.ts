import test from 'node:test';
import assert from 'node:assert/strict';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { reportEventHandler, getReportStatusHandler, listReportsHandler, hideEventHandler, unhideEventHandler, listShadowBansHandler, liftShadowBanHandler, promoteTagHandler, listAuditTrailHandler } from './moderation.ts';
import { createEventHandler, listEventsHandler, getEventHandler } from './events.ts';
import { voteHandler } from './votes.ts';
import { createTagHandler } from './system.ts';

async function setup() {
  const io = await createInMemoryIO();
  const org = await io.orgRepo.create({ name: 'Test Org', slug: 'testorg', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 2 });
  const orgId = org.id;

  // Create users
  const { token: adminToken, user: admin } = await registerVerified({ firstName: 'Admin', lastName: 'X', email: 'admin@a.com', password: 'password123' }, orgId, io);
  await io.userRepo.update(admin.id, { role: 'Admin' });

  const { token: modToken, user: mod } = await registerVerified({ firstName: 'Mod', lastName: 'X', email: 'mod@a.com', password: 'password123' }, orgId, io);
  await io.userRepo.update(mod.id, { role: 'Moderator' });

  const { token: user1Token, user: user1 } = await registerVerified({ firstName: 'U1', lastName: 'X', email: 'u1@a.com', password: 'password123' }, orgId, io);
  const { token: user2Token, user: user2 } = await registerVerified({ firstName: 'U2', lastName: 'X', email: 'u2@a.com', password: 'password123' }, orgId, io);
  const { token: user3Token, user: user3 } = await registerVerified({ firstName: 'U3', lastName: 'X', email: 'u3@a.com', password: 'password123' }, orgId, io);

  const adminReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
  const modReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${modToken}` } });
  const u1Req = new Request('http://localhost/', { headers: { authorization: `Bearer ${user1Token}` } });
  const u2Req = new Request('http://localhost/', { headers: { authorization: `Bearer ${user2Token}` } });
  const u3Req = new Request('http://localhost/', { headers: { authorization: `Bearer ${user3Token}` } });

  return { io, orgId, adminReq, modReq, u1Req, u2Req, u3Req, user1 };
}

test('Moderation Handlers', async (t) => {
  await t.test('duplicate reporting prevention', async () => {
    const { io, orgId, u1Req, u2Req } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    await reportEventHandler(u2Req, orgId, event.id, { reason: 'spam' }, io);
    await assert.rejects(
      reportEventHandler(u2Req, orgId, event.id, { reason: 'spam' }, io),
      /BAD_REQUEST/
    );
  });

  await t.test('automatic shadow ban at threshold', async () => {
    const { io, orgId, u1Req, u2Req, u3Req, user1 } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    // threshold is 2
    await reportEventHandler(u2Req, orgId, event.id, { reason: 'spam' }, io);
    let u1 = await io.userRepo.getById(user1.id);
    assert.equal(u1?.isShadowBanned, false);

    await reportEventHandler(u3Req, orgId, event.id, { reason: 'offensive_content' }, io);
    u1 = await io.userRepo.getById(user1.id);
    assert.equal(u1?.isShadowBanned, true);

    const updatedEvent = await io.eventRepo.getById(event.id);
    assert.equal(updatedEvent?.isHidden, true);
  });

  await t.test('viewer-dependent visibility', async () => {
    const { io, orgId, u1Req, u2Req, user1 } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    // Apply shadow ban manually
    await io.userRepo.update(user1.id, { isShadowBanned: true });

    // U1 (creator) can see it
    const u1Events = await listEventsHandler(u1Req, orgId, io);
    assert.equal(u1Events.length, 1);
    
    // U2 cannot see it
    const u2Events = await listEventsHandler(u2Req, orgId, io);
    assert.equal(u2Events.length, 0);

    // Get directly
    await assert.doesNotReject(getEventHandler(u1Req, orgId, event.id, io));
    await assert.rejects(getEventHandler(u2Req, orgId, event.id, io), /NOT_FOUND/);
  });

  await t.test('moderators and admins still open events of shadow-banned authors', async () => {
    const { io, orgId, u1Req, modReq, adminReq, user1 } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);
    await io.userRepo.update(user1.id, { isShadowBanned: true });

    assert.equal((await getEventHandler(modReq, orgId, event.id, io)).id, event.id);
    assert.equal((await getEventHandler(adminReq, orgId, event.id, io)).id, event.id);
  });

  await t.test('a hidden event is only opened by its creator and moderators', async () => {
    const { io, orgId, u1Req, u2Req, modReq } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);
    await hideEventHandler(modReq, orgId, event.id, io);

    await assert.rejects(getEventHandler(u2Req, orgId, event.id, io), /NOT_FOUND/);
    await assert.rejects(getEventHandler(new Request('http://localhost/'), orgId, event.id, io), /NOT_FOUND/);
    assert.equal((await getEventHandler(u1Req, orgId, event.id, io)).isHidden, true);
    assert.equal((await getEventHandler(modReq, orgId, event.id, io)).isHidden, true);
  });

  await t.test('manual hide/unhide', async () => {
    const { io, orgId, u1Req, modReq } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    await hideEventHandler(modReq, orgId, event.id, io);
    let e = await io.eventRepo.getById(event.id);
    assert.equal(e?.isHidden, true);

    await unhideEventHandler(modReq, orgId, event.id, io);
    e = await io.eventRepo.getById(event.id);
    assert.equal(e?.isHidden, false);
  });

  await t.test('lifting shadow bans', async () => {
    const { io, orgId, user1, modReq } = await setup();
    await io.userRepo.update(user1.id, { isShadowBanned: true });

    let bans = await listShadowBansHandler(modReq, orgId, io);
    assert.equal(bans.length, 1);

    await liftShadowBanHandler(modReq, orgId, user1.id, io);
    
    bans = await listShadowBansHandler(modReq, orgId, io);
    assert.equal(bans.length, 0);
  });

  await t.test('tag promotion', async () => {
    const { io, orgId, adminReq, modReq } = await setup();
    // System handlers might need superadmin or admin, let's use adminReq to create tag
    // Wait, createTagHandler requires Superadmin. In users.ts, who can create tags?
    // Let's create it manually in the repo.
    const tag = await io.tagRepo.create({ id: 'tag-1', name: 'indie', isSystemDefined: false });

    await promoteTagHandler(modReq, tag.id, io);
    
    const updated = await io.tagRepo.getById(tag.id);
    assert.equal(updated?.isSystemDefined, true);
  });

  await t.test('audit logging', async () => {
    const { io, orgId, u1Req, modReq, adminReq } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    await hideEventHandler(modReq, orgId, event.id, io);
    
    const audits = await listAuditTrailHandler(adminReq, orgId, io);
    assert.ok(audits.find(a => a.action === 'hide_event' && a.targetId === event.id));
  });

  await t.test('RBAC - Member cannot hide event', async () => {
    const { io, orgId, u1Req, u2Req } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    await assert.rejects(hideEventHandler(u2Req, orgId, event.id, io), /FORBIDDEN/);
  });

  await t.test('RBAC - Moderator cannot view audit trail', async () => {
    const { io, orgId, modReq } = await setup();
    await assert.rejects(listAuditTrailHandler(modReq, orgId, io), /FORBIDDEN/);
  });

  await t.test('an Event opened by id carries its vote count', async () => {
    const { io, orgId, u1Req, u2Req, u3Req } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);
    await voteHandler(u2Req, orgId, event.id, io);
    await voteHandler(u3Req, orgId, event.id, io);

    assert.equal((await getEventHandler(u1Req, orgId, event.id, io)).voteCount, 2);
  });

  await t.test('a User can tell whether they already reported an Event', async () => {
    const { io, orgId, u1Req, u2Req } = await setup();
    const event = await createEventHandler(u1Req, orgId, {
      title: 'Ev1', description: '...', location: '...', isHidden: false, schedule: [{ date: '2100-01-01' }], tags: [], links: []
    }, io);

    assert.deepEqual(await getReportStatusHandler(u2Req, orgId, event.id, io), { reported: false });
    await reportEventHandler(u2Req, orgId, event.id, { reason: 'spam' }, io);
    assert.deepEqual(await getReportStatusHandler(u2Req, orgId, event.id, io), { reported: true });
    assert.deepEqual(await getReportStatusHandler(u1Req, orgId, event.id, io), { reported: false });
    await assert.rejects(getReportStatusHandler(new Request('http://localhost/'), orgId, event.id, io), /UNAUTHORIZED/);
    await assert.rejects(getReportStatusHandler(u2Req, orgId, 'missing', io), /NOT_FOUND/);
  });
});
