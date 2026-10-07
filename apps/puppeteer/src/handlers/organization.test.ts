import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler
} from './organization.ts';
import { createInMemoryIO } from '../io/in-memory.ts';

test('Organization Handlers', async (t) => {
  await t.test('create organization stores all properties correctly and defaults shadowBanThreshold to 5', async () => {
    const io = await createInMemoryIO();
    const input = {
      name: 'Test Org',
      slug: 'TO', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      description: 'A test organization',
      logo: 'logo.png',
      url: 'https://test.org',
      colorScheme: 'dark',
      location: 'Test City',
      latitude: 10.5,
      longitude: -45.2
    };

    const org = await createOrganizationHandler(input, io);

    assert.ok(org.id);
    assert.equal(org.name, 'Test Org');
    assert.equal(org.slug, 'TO');
    assert.equal(org.description, 'A test organization');
    assert.equal(org.logo, 'logo.png');
    assert.equal(org.url, 'https://test.org');
    assert.equal(org.colorScheme, 'dark');
    assert.equal(org.location, 'Test City');
    assert.equal(org.latitude, 10.5);
    assert.equal(org.longitude, -45.2);
    // Default shadowBanThreshold
    assert.equal(org.shadowBanThreshold, 5);
  });

  await t.test('list organizations returns all created orgs', async () => {
    const io = await createInMemoryIO();
    await createOrganizationHandler({ name: 'Org 1', slug: 'O1' }, io);
    await createOrganizationHandler({ name: 'Org 2', slug: 'O2' }, io);

    const orgs = await listOrganizationsHandler(io);
    assert.equal(orgs.length, 2);
    assert.ok(orgs.every(o => !Number.isNaN(Date.parse(o.createdAt)) && o.updatedAt === o.createdAt));
    assert.equal(orgs[0]?.name, 'Org 1');
    assert.equal(orgs[1]?.name, 'Org 2');
  });

  await t.test('update organization modifies only specified fields', async () => {
    const io = await createInMemoryIO();
    const org = await createOrganizationHandler({
      name: 'Original Name',
      slug: 'ON',
      location: 'Old Location'
    }, io);

    const updatedOrg = await updateOrganizationHandler(org.id, {
      name: 'New Name'
    }, io);

    assert.ok(updatedOrg);
    assert.equal(updatedOrg.name, 'New Name');
    assert.equal(updatedOrg.slug, 'ON');
    assert.equal(updatedOrg.location, 'Old Location');

    // Verify it was actually saved
    const fetchedOrg = await getOrganizationHandler(org.id, io);
    assert.ok(fetchedOrg);
    assert.equal(fetchedOrg.name, 'New Name');
  });

  await t.test('getOrganizationHandler returns null for non-existent org', async () => {
    const io = await createInMemoryIO();
    const org = await getOrganizationHandler('non-existent', io);
    assert.equal(org, null);
  });

  await t.test('updateOrganizationHandler returns null for non-existent org', async () => {
    const io = await createInMemoryIO();
    const org = await updateOrganizationHandler('non-existent', { name: 'Test' }, io);
    assert.equal(org, null);
  });
});
