import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventHandler, listEventsHandler, getEventHandler, deleteEventHandler } from './events.ts';
import { registerHandler } from './auth.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('Event Handlers', async (t) => {
  await t.test('create event with all properties', async () => {
    const io = await createInMemoryIO();
    const { token, user } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const event = await createEventHandler(req, 'org-1', {
      title: 'Mega Event',
      description: 'A very big event',
      location: 'Main Hall',
      latitude: 10.5,
      longitude: -20.3,
      bannerImage: 'http://img.com/a.png',
      isHidden: false,
      schedule: [{ date: '2100-10-01', startTime: '10:00', endTime: '12:00' }],
      tags: [{ tagId: 't1', isFreeForm: false }],
      links: [{ labelId: 'l1', url: 'http://link.com' }]
    }, io);

    assert.ok(event.id);
    assert.equal(event.title, 'Mega Event');
    assert.equal(event.latitude, 10.5);
    assert.equal(event.schedule[0]?.date, '2100-10-01');
    assert.equal(event.tags[0]?.tagId, 't1');
    assert.equal(event.links[0]?.url, 'http://link.com');
  });

  await t.test('create event with multi-day schedule', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const event = await createEventHandler(req, 'org-1', {
      title: 'Multi-day Event',
      description: '...',
      location: '...',
      isHidden: false,
      schedule: [
        { date: '2100-10-01', startTime: '10:00', endTime: '12:00' },
        { date: '2100-10-02', startTime: '14:00', endTime: '18:00' }
      ],
      tags: [],
      links: []
    }, io);

    assert.equal(event.schedule.length, 2);
    assert.equal(event.schedule[1]?.startTime, '14:00');
  });

  await t.test('DayEntry with end time but no start time is rejected', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await assert.rejects(createEventHandler(req, 'org-1', {
      title: 'Bad Schedule',
      description: '...',
      location: '...',
      isHidden: false,
      schedule: [{ date: '2100-10-01', endTime: '12:00' }],
      tags: [],
      links: []
    }, io), /BAD_REQUEST/);
  });

  await t.test('list events excludes soft-deleted events', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const e1 = await createEventHandler(req, 'org-1', {
      title: 'Ev1', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);
    
    await createEventHandler(req, 'org-1', {
      title: 'Ev2', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);

    await deleteEventHandler(req, 'org-1', e1.id, io);

    const events = await listEventsHandler(req, 'org-1', io);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.title, 'Ev2');
  });

  await t.test('list events excludes hidden events', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await createEventHandler(req, 'org-1', {
      title: 'Hidden', description: '...', location: '...', isHidden: true,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);
    
    const events = await listEventsHandler(req, 'org-1', io);
    assert.equal(events.length, 0);
  });

  await t.test('list events excludes events past their last date', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await createEventHandler(req, 'org-1', {
      title: 'Past Event', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '1990-01-01' }], tags: [], links: []
    }, io);
    
    const events = await listEventsHandler(req, 'org-1', io);
    assert.equal(events.length, 0);
  });

  await t.test('list events shows only predefined tags, not free-form ones', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await createEventHandler(req, 'org-1', {
      title: 'Event', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }],
      tags: [
        { tagId: 't1', isFreeForm: false },
        { tagId: 't2', isFreeForm: true }
      ],
      links: []
    }, io);
    
    const events = await listEventsHandler(req, 'org-1', io);
    assert.equal(events[0]?.tags.length, 1);
    assert.equal(events[0]?.tags[0]?.tagId, 't1');
  });

  await t.test('only the creator can soft-delete their own event', async () => {
    const io = await createInMemoryIO();
    const { token: cToken } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const { token: mToken } = await registerHandler({ firstName: 'Member', lastName: 'Y', email: 'm@a.com', password: '123' }, 'org-1', io);
    
    const cReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${cToken}` } });
    const mReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${mToken}` } });
    
    const e1 = await createEventHandler(cReq, 'org-1', {
      title: 'Ev', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);

    // Member fails to delete
    await assert.rejects(deleteEventHandler(mReq, 'org-1', e1.id, io), /FORBIDDEN/);

    // Creator succeeds
    await deleteEventHandler(cReq, 'org-1', e1.id, io);
    const delEvent = await getEventHandler(cReq, 'org-1', e1.id, io).catch(e => e.message);
    assert.equal(delEvent, 'NOT_FOUND');
  });

  await t.test('event model supports editing (fields are mutable) but no edit handler is exposed yet', async () => {
    const io = await createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Creator', lastName: 'X', email: 'c@a.com', password: '123' }, 'org-1', io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const e1 = await createEventHandler(req, 'org-1', {
      title: 'Ev', description: '...', location: '...', isHidden: false,
      schedule: [{ date: '2100-10-01' }], tags: [], links: []
    }, io);

    const updated = await io.eventRepo.update(e1.id, { title: 'Updated Ev' });
    assert.equal(updated?.title, 'Updated Ev');
  });
});
