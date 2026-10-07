import test from 'node:test';
import assert from 'node:assert/strict';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { connectDeviceHandler, listPendingDevicesGlobalHandler, listPendingDevicesOrgHandler, listActiveDevicesOrgHandler, getDeviceHandler, approveDeviceHandler, rejectDeviceHandler, getCurrentDeviceHandler } from './devices.ts';

async function setup() {
  const io = await createInMemoryIO();
  
  const org1 = await io.orgRepo.create({ name: 'Org 1', slug: 'org1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });
  const org2 = await io.orgRepo.create({ name: 'Org 2', slug: 'org2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });

  const { token: superToken, user: superadmin } = await registerVerified({ firstName: 'Super', lastName: 'X', email: 's@a.com', password: 'password123' }, org1.id, io);
  await io.userRepo.update(superadmin.id, { role: 'Superadmin' });

  const { token: admin1Token, user: admin1 } = await registerVerified({ firstName: 'A1', lastName: 'X', email: 'a1@a.com', password: 'password123' }, org1.id, io);
  await io.userRepo.update(admin1.id, { role: 'Admin' });

  const { token: admin2Token, user: admin2 } = await registerVerified({ firstName: 'A2', lastName: 'X', email: 'a2@a.com', password: 'password123' }, org2.id, io);
  await io.userRepo.update(admin2.id, { role: 'Admin' });

  const { token: memberToken, user: member } = await registerVerified({ firstName: 'M', lastName: 'X', email: 'm@a.com', password: 'password123' }, org1.id, io);

  const req = (token: string) => new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

  return {
    io, org1: org1.id, org2: org2.id,
    sReq: req(superToken),
    a1Req: req(admin1Token),
    a2Req: req(admin2Token),
    mReq: req(memberToken)
  };
}

test('Device Handlers', async (t) => {
  await t.test('device connects without org → appears in Superadmin pending queue', async () => {
    const { io, sReq, a1Req } = await setup();
    await connectDeviceHandler({ identifier: 'mac-1' }, io);

    const sPending = await listPendingDevicesGlobalHandler(sReq, io);
    assert.equal(sPending.length, 1);
    
    // Admin cannot see it in global or their org
    await assert.rejects(listPendingDevicesGlobalHandler(a1Req, io), /FORBIDDEN/);
  });

  await t.test('device connects with org → appears in that org Admin pending queue', async () => {
    const { io, org1, org2, a1Req, a2Req } = await setup();
    await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);

    const a1Pending = await listPendingDevicesOrgHandler(a1Req, org1, io);
    assert.equal(a1Pending.length, 1);
    
    // a2 cannot see it in their org
    const a2Pending = await listPendingDevicesOrgHandler(a2Req, org2, io);
    assert.equal(a2Pending.length, 0);
  });

  await t.test('Superadmin approves pending device → assigns org, name, location → device becomes active', async () => {
    const { io, org1, sReq } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-1' }, io);

    await approveDeviceHandler(sReq, d.id, { name: 'Main Hall', location: 'Floor 1', organizationId: org1 }, io);

    const active = await getDeviceHandler(sReq, org1, d.id, io);
    assert.equal(active.status, 'active');
    assert.equal(active.name, 'Main Hall');
    assert.equal(active.location, 'Floor 1');
    assert.equal(active.organizationId, org1);
  });

  await t.test('org Admin approves device that identified their org → device becomes active', async () => {
    const { io, org1, a1Req } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);

    await approveDeviceHandler(a1Req, d.id, { name: 'Room 2', location: 'Floor 2' }, io);

    const active = await getDeviceHandler(a1Req, org1, d.id, io);
    assert.equal(active.status, 'active');
  });

  await t.test('org Admin cannot approve a device that belongs to another org queue', async () => {
    const { io, org1, org2, a2Req } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);

    await assert.rejects(
      approveDeviceHandler(a2Req, d.id, { name: 'X', location: 'Y' }, io),
      /FORBIDDEN/
    );
  });

  await t.test('rejected device is excluded from pending and active lists', async () => {
    const { io, org1, a1Req } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);

    await rejectDeviceHandler(a1Req, d.id, io);

    const pending = await listPendingDevicesOrgHandler(a1Req, org1, io);
    assert.equal(pending.length, 0);

    const active = await listActiveDevicesOrgHandler(a1Req, org1, io);
    assert.equal(active.length, 0);
  });

  await t.test('list enrolled devices returns only active devices for the org', async () => {
    const { io, org1, a1Req } = await setup();
    const { device: d1 } = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);
    const { device: d2 } = await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);

    await approveDeviceHandler(a1Req, d1.id, { name: 'D1', location: 'L1' }, io);

    const active = await listActiveDevicesOrgHandler(a1Req, org1, io);
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, d1.id);
  });

  await t.test('Member cannot access device endpoints (forbidden)', async () => {
    const { io, org1, mReq } = await setup();
    await assert.rejects(listPendingDevicesOrgHandler(mReq, org1, io), /FORBIDDEN/);
    await assert.rejects(listActiveDevicesOrgHandler(mReq, org1, io), /FORBIDDEN/);
  });

  await t.test('device in pending state has no name or location until approved', async () => {
    const { io } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-1' }, io);
    
    assert.equal(d.name, undefined);
    assert.equal(d.location, undefined);
    assert.equal(d.status, 'pending');
  });

  await t.test('connect persists the identifier', async () => {
    const { io } = await setup();
    const { device: d } = await connectDeviceHandler({ identifier: 'mac-1' }, io);

    assert.equal(d.identifier, 'mac-1');
    assert.equal((await io.deviceRepo.getById(d.id))?.identifier, 'mac-1');
  });

  await t.test('reconnecting a pending device reuses its row and rotates the token', async () => {
    const { io, sReq } = await setup();
    const first = await connectDeviceHandler({ identifier: 'mac-1' }, io);
    const second = await connectDeviceHandler({ identifier: 'mac-1' }, io);

    assert.equal(second.device.id, first.device.id);
    assert.notEqual(second.token, first.token);
    assert.equal((await listPendingDevicesGlobalHandler(sReq, io)).length, 1);

    const devReq = (token: string) => new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    await assert.rejects(getCurrentDeviceHandler(devReq(first.token), io), /UNAUTHORIZED/);
    assert.equal((await getCurrentDeviceHandler(devReq(second.token), io)).id, first.device.id);
  });

  await t.test('reconnecting an active device creates a new pending device', async () => {
    const { io, org1, a1Req } = await setup();
    const first = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);
    await approveDeviceHandler(a1Req, first.device.id, { name: 'D1', location: 'L1' }, io);

    const second = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);

    assert.notEqual(second.device.id, first.device.id);
    assert.equal(second.device.status, 'pending');
    assert.equal((await io.deviceRepo.getById(first.device.id))?.status, 'active');
  });

  await t.test('device reads its own record whatever its status', async () => {
    const { io, org1, a1Req } = await setup();
    const devReq = (token: string) => new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    const pending = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);
    assert.equal((await getCurrentDeviceHandler(devReq(pending.token), io)).status, 'pending');

    await approveDeviceHandler(a1Req, pending.device.id, { name: 'D1', location: 'L1' }, io);
    const me = await getCurrentDeviceHandler(devReq(pending.token), io);
    assert.equal(me.status, 'active');
    assert.equal(me.organizationId, org1);
    assert.equal(me.name, 'D1');

    const rejected = await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);
    await rejectDeviceHandler(a1Req, rejected.device.id, io);
    assert.equal((await getCurrentDeviceHandler(devReq(rejected.token), io)).status, 'rejected');
  });

  await t.test('unknown device token is unauthorized', async () => {
    const { io } = await setup();
    const req = new Request('http://localhost/', { headers: { authorization: 'Bearer nope' } });
    await assert.rejects(getCurrentDeviceHandler(req, io), /UNAUTHORIZED/);
  });
});
