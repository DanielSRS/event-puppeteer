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

  await t.test('Member cannot create a system-defined Tag nor a LinkLabel, but can create a free-form Tag', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token } = await registerVerified({ firstName: 'Member', lastName: 'User', email: 'm@a.com', password: 'password123' }, org.id, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    await assert.rejects(createTagHandler(req, { name: 'Music', isSystemDefined: true }, io), /FORBIDDEN/);
    await assert.rejects(createLinkLabelHandler(req, { name: 'Tickets' }, io), /FORBIDDEN/);

    const freeForm = await createTagHandler(req, { name: 'Jazz night', isSystemDefined: false }, io);
    assert.equal(freeForm.name, 'Jazz night');
    assert.equal(freeForm.isSystemDefined, false);
    assert.deepEqual(await listTagsHandler(io), [freeForm]);
  });

  await t.test('anonymous requests cannot create a Tag', async () => {
    const io = await createInMemoryIO();
    await assert.rejects(createTagHandler(new Request('http://localhost/'), { name: 'Music', isSystemDefined: false }, io), /UNAUTHORIZED/);
  });

  await t.test('Tag names are trimmed and unique regardless of case', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token } = await registerVerified({ firstName: 'Member', lastName: 'User', email: 'm@a.com', password: 'password123' }, org.id, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    const created = await createTagHandler(req, { name: '  Music ', isSystemDefined: false }, io);
    assert.equal(created.name, 'Music');

    await assert.rejects(createTagHandler(req, { name: 'music', isSystemDefined: false }, io), /TAG_EXISTS/);
    await assert.rejects(createTagHandler(req, { name: ' MUSIC  ', isSystemDefined: false }, io), /TAG_EXISTS/);
    await assert.rejects(createTagHandler(req, { name: '   ', isSystemDefined: false }, io), /BAD_REQUEST/);
    assert.equal((await listTagsHandler(io)).length, 1);
  });

  await t.test('LinkLabel names are trimmed and unique regardless of case', async () => {
    const io = await createInMemoryIO();
    const org = await io.orgRepo.create({ name: 'Org', slug: 'org-1', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { token, user } = await registerVerified({ firstName: 'Super', lastName: 'Admin', email: 's@a.com', password: 'password123' }, org.id, io);
    await io.userRepo.update(user.id, { role: 'Superadmin' });
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    const created = await createLinkLabelHandler(req, { name: ' Tickets ' }, io);
    assert.equal(created.name, 'Tickets');

    await assert.rejects(createLinkLabelHandler(req, { name: 'TICKETS' }, io), /LINK_LABEL_EXISTS/);
    await assert.rejects(createLinkLabelHandler(req, { name: '' }, io), /BAD_REQUEST/);
    assert.equal((await listLinkLabelsHandler(io)).length, 1);
  });
});
