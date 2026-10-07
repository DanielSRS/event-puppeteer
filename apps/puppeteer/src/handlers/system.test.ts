import test from 'node:test';
import assert from 'node:assert/strict';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './system.ts';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('System Handlers', async (t) => {
  await t.test('Superadmin can create Tag and LinkLabel', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token, user } = await registerVerified({ firstName: 'Super', lastName: 'Admin', email: 's@a.com', password: 'password123' }, org.id, io);
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
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token } = await registerVerified({ firstName: 'Member', lastName: 'User', email: 'm@a.com', password: 'password123' }, org.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    
    await assert.rejects(createTagHandler(req, { name: 'Music', isSystemDefined: true }, io), /FORBIDDEN/);
    await assert.rejects(createLinkLabelHandler(req, { name: 'Tickets' }, io), /FORBIDDEN/);
  });
});
