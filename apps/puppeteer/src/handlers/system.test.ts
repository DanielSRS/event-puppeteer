import test from 'node:test';
import assert from 'node:assert/strict';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './system.ts';
import { registerHandler } from './auth.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('System Handlers', async (t) => {
  await t.test('Superadmin can create Tag and LinkLabel', async () => {
    const io = createInMemoryIO();
    const { token, user } = await registerHandler({ firstName: 'Super', lastName: 'Admin', email: 's@a.com', password: '123' }, 'org-1', io);
    await io.userRepo.update(user.id, { role: 'Superadmin' });

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    const tag = await createTagHandler(req, { name: 'Music', isSystemDefined: true }, io);
    assert.equal(tag.name, 'Music');

    const label = await createLinkLabelHandler(req, { name: 'Tickets' }, io);
    assert.equal(label.name, 'Tickets');

    const tags = await listTagsHandler(io);
    assert.equal(tags.length, 1);

    const labels = await listLinkLabelsHandler(io);
    assert.equal(labels.length, 1);
  });

  await t.test('Member cannot create Tag or LinkLabel', async () => {
    const io = createInMemoryIO();
    const { token } = await registerHandler({ firstName: 'Member', lastName: 'User', email: 'm@a.com', password: '123' }, 'org-1', io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await assert.rejects(createTagHandler(req, { name: 'Music', isSystemDefined: true }, io), /FORBIDDEN/);
    await assert.rejects(createLinkLabelHandler(req, { name: 'Tickets' }, io), /FORBIDDEN/);
  });
});
