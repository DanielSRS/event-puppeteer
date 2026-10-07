import test from 'node:test';
import assert from 'node:assert/strict';
import { voteHandler, getVoteStatusHandler } from './votes.ts';
import { eventFeedHandler } from './feed.ts';
import { createEventHandler, deleteEventHandler } from './events.ts';
import { registerHandler } from './auth.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('Votes & Feed Handlers', async (t) => {
  await t.test('voting toggles and feed calculates weights correctly', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token, user } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, org.id, io);
    const { token: user2Token } = await registerHandler({ firstName: 'Voter', lastName: 'Y', email: 'v@a.com', password: '123' }, org.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    const reqVoter = new Request('http://localhost/', { headers: { authorization: `Bearer ${user2Token}` } });
    
    // Create two events
    const today = new Date();
    today.setDate(today.getDate() + 1); // Tomorrow
    const tmrStr = today.toISOString().split('T')[0]!;

    const e1 = await createEventHandler(req, org.id, {
      title: 'Event 1', description: '...', location: '...', isHidden: false,
      schedule: [{ date: tmrStr }], tags: [], links: []
    }, io);

    const e2 = await createEventHandler(req, org.id, {
      title: 'Event 2', description: '...', location: '...', isHidden: false,
      schedule: [{ date: tmrStr }], tags: [], links: []
    }, io);

    // Initial state: 0 votes
    let status = await getVoteStatusHandler(req, org.id, e1.id, io);
    assert.equal(status.voted, false);

    // Vote on e1
    let result = await voteHandler(req, org.id, e1.id, io);
    assert.equal(result.status, 'voted');
    
    status = await getVoteStatusHandler(req, org.id, e1.id, io);
    assert.equal(status.voted, true);

    // Vote again (toggle off)
    result = await voteHandler(req, org.id, e1.id, io);
    assert.equal(result.status, 'unvoted');

    // Vote for real
    await voteHandler(req, org.id, e1.id, io);
    await voteHandler(reqVoter, org.id, e1.id, io); // e1 gets 2 votes
    await voteHandler(req, org.id, e2.id, io); // e2 gets 1 vote

    // Verify feed weighting (e1 should be first, e2 second)
    const feed = await eventFeedHandler(org.id, io);
    assert.equal(feed.length, 2);
    assert.equal(feed[0]?.id, e1.id);
    assert.equal(feed[0]?.voteCount, 2);
    assert.ok(feed[0]!.weight > feed[1]!.weight);
    assert.equal(feed[1]?.id, e2.id);
    assert.equal(feed[1]?.voteCount, 1);
  });

  await t.test('feed excludes hidden, deleted, and expired events', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, org.id, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const todayStr = new Date().toISOString().split('T')[0]!;

    // Valid
    await createEventHandler(req, org.id, {
      title: 'Valid', description: '...', location: '...', isHidden: false,
      schedule: [{ date: todayStr }], tags: [], links: []
    }, io);

    // Hidden
    await createEventHandler(req, org.id, {
      title: 'Hidden', description: '...', location: '...', isHidden: true,
      schedule: [{ date: todayStr }], tags: [], links: []
    }, io);

    // Deleted
    const eDel = await createEventHandler(req, org.id, {
      title: 'Deleted', description: '...', location: '...', isHidden: false,
      schedule: [{ date: todayStr }], tags: [], links: []
    }, io);
    await deleteEventHandler(req, org.id, eDel.id, io);

    // Expired
    await createEventHandler(req, org.id, {
      title: 'Expired', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '1990-01-01' }], tags: [], links: []
    }, io);

    const feed = await eventFeedHandler(org.id, io);
    assert.equal(feed.length, 1);
    assert.equal(feed[0]?.title, 'Valid');
  });

  await t.test('one vote per user per event enforced at IO level', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token, user } = await registerHandler({ firstName: 'C', lastName: 'X', email: 'c@a.com', password: '123' }, org.id, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const tmrStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]!;
    const e = await createEventHandler(req, org.id, {
      title: 'Ev', description: '...', location: '...', isHidden: false,
      schedule: [{ date: tmrStr }], tags: [], links: []
    }, io);

    // Directly use IO to create duplicate vote
    await io.voteRepo.create({ userId: user.id, eventId: e.id, createdAt: new Date().toISOString() });
    await io.voteRepo.create({ userId: user.id, eventId: e.id, createdAt: new Date().toISOString() });
    
    const count = await io.voteRepo.countByEvent(e.id);
    assert.equal(count, 1);
  });
});
