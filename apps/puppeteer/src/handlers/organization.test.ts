import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler
} from './organization.ts';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { seedSuperadminHandler } from './seed.ts';
import { loginHandler } from './auth.ts';

const asToken = (token: string) => new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

async function setup() {
  const io = await createInMemoryIO();
  await seedSuperadminHandler({ email: 'root@a.com', password: 'secret-123', firstName: 'S', lastName: 'A' }, io);
  const { token } = await loginHandler({ email: 'root@a.com', password: 'secret-123' }, io);
  return { io, sReq: asToken(token) };
}

async function userOf(io: Awaited<ReturnType<typeof createInMemoryIO>>, orgId: string, email: string, role: 'Admin' | 'Member') {
  const { token, user } = await registerVerified({ firstName: 'U', lastName: 'X', email, password: 'password123' }, orgId, io);
  await io.userRepo.update(user.id, { role });
  return asToken(token);
}

test('Organization Handlers', async (t) => {
  await t.test('create organization stores all properties correctly and defaults shadowBanThreshold to 5', async () => {
    const { io, sReq } = await setup();
    const input = {
      name: 'Test Org',
      slug: 'TO', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      description: 'A test organization',
      url: 'https://test.org',
      colorScheme: 'dark',
      location: 'Test City',
      latitude: 10.5,
      longitude: -45.2
    };

    const org = await createOrganizationHandler(sReq, input, io);

    assert.ok(org.id);
    assert.equal(org.name, 'Test Org');
    assert.equal(org.slug, 'TO');
    assert.equal(org.description, 'A test organization');
    assert.equal(org.url, 'https://test.org');
    assert.equal(org.colorScheme, 'dark');
    assert.equal(org.location, 'Test City');
    assert.equal(org.latitude, 10.5);
    assert.equal(org.longitude, -45.2);
    // Default shadowBanThreshold
    assert.equal(org.shadowBanThreshold, 5);
  });

  await t.test('list organizations returns all created orgs', async () => {
    const { io, sReq } = await setup();
    await createOrganizationHandler(sReq, { name: 'Org 1', slug: 'O1' }, io);
    await createOrganizationHandler(sReq, { name: 'Org 2', slug: 'O2' }, io);

    const orgs = await listOrganizationsHandler(sReq, io);
    assert.equal(orgs.length, 2);
    assert.ok(orgs.every(o => !Number.isNaN(Date.parse(o.createdAt)) && o.updatedAt === o.createdAt));
    assert.equal(orgs[0]?.name, 'Org 1');
    assert.equal(orgs[1]?.name, 'Org 2');
  });

  await t.test('update organization modifies only specified fields', async () => {
    const { io, sReq } = await setup();
    const org = await createOrganizationHandler(sReq, {
      name: 'Original Name',
      slug: 'ON',
      location: 'Old Location'
    }, io);

    const updatedOrg = await updateOrganizationHandler(sReq, org.id, {
      name: 'New Name'
    }, io);

    assert.ok(updatedOrg);
    assert.equal(updatedOrg.name, 'New Name');
    assert.equal(updatedOrg.slug, 'ON');
    assert.equal(updatedOrg.location, 'Old Location');

    // Verify it was actually saved
    const fetchedOrg = await getOrganizationHandler(new Request('http://localhost/'), org.id, io);
    assert.ok(fetchedOrg);
    assert.equal(fetchedOrg.name, 'New Name');
  });

  await t.test('getOrganizationHandler returns null for non-existent org', async () => {
    const { io } = await setup();
    const org = await getOrganizationHandler(new Request('http://localhost/'), 'non-existent', io);
    assert.equal(org, null);
  });

  await t.test('updateOrganizationHandler returns null for non-existent org', async () => {
    const { io, sReq } = await setup();
    const org = await updateOrganizationHandler(sReq, 'non-existent', { name: 'Test' }, io);
    assert.equal(org, null);
  });

  await t.test('only a Superadmin creates or lists organizations', async () => {
    const { io, sReq } = await setup();
    const org = await createOrganizationHandler(sReq, { name: 'Org', slug: 'org' }, io);
    const adminReq = await userOf(io, org.id, 'admin@a.com', 'Admin');
    const anonymous = new Request('http://localhost/');

    await assert.rejects(createOrganizationHandler(adminReq, { name: 'X', slug: 'x' }, io), /FORBIDDEN/);
    await assert.rejects(createOrganizationHandler(anonymous, { name: 'X', slug: 'x' }, io), /UNAUTHORIZED/);
    await assert.rejects(listOrganizationsHandler(adminReq, io), /FORBIDDEN/);
    await assert.rejects(listOrganizationsHandler(anonymous, io), /UNAUTHORIZED/);
  });

  await t.test('an Admin updates only their own organization', async () => {
    const { io, sReq } = await setup();
    const own = await createOrganizationHandler(sReq, { name: 'Own', slug: 'own' }, io);
    const other = await createOrganizationHandler(sReq, { name: 'Other', slug: 'other' }, io);
    const adminReq = await userOf(io, own.id, 'admin@a.com', 'Admin');
    const memberReq = await userOf(io, own.id, 'member@a.com', 'Member');

    assert.equal((await updateOrganizationHandler(adminReq, own.id, { name: 'Renamed' }, io))?.name, 'Renamed');
    await assert.rejects(updateOrganizationHandler(adminReq, other.id, { name: 'X' }, io), /FORBIDDEN/);
    await assert.rejects(updateOrganizationHandler(memberReq, own.id, { name: 'X' }, io), /FORBIDDEN/);
    await assert.rejects(updateOrganizationHandler(new Request('http://localhost/'), own.id, { name: 'X' }, io), /UNAUTHORIZED/);
  });

  await t.test('a slug already in use is refused on create and on update', async () => {
    const { io, sReq } = await setup();
    const first = await createOrganizationHandler(sReq, { name: 'First', slug: 'taken' }, io);
    const second = await createOrganizationHandler(sReq, { name: 'Second', slug: 'free' }, io);

    await assert.rejects(createOrganizationHandler(sReq, { name: 'Copy', slug: 'taken' }, io), /ORGANIZATION_SLUG_EXISTS/);
    await assert.rejects(updateOrganizationHandler(sReq, second.id, { slug: 'taken' }, io), /ORGANIZATION_SLUG_EXISTS/);
    assert.equal((await updateOrganizationHandler(sReq, first.id, { slug: 'taken', name: 'Same slug kept' }, io))?.name, 'Same slug kept');
  });
});
