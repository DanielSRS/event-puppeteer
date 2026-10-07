import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryIO } from '../io/in-memory.ts';
import { connectDeviceHandler, listPendingDevicesGlobalHandler, listPendingDevicesOrgHandler, listActiveDevicesOrgHandler, getDeviceHandler, approveDeviceHandler, rejectDeviceHandler } from './devices.ts';
import { registerHandler } from './auth.ts';

async function setup() {
  const io = createInMemoryIO();
  
  const org1 = await io.orgRepo.create({ name: 'Org 1', shortName: 'org1', shadowBanThreshold: 5 });
  const org2 = await io.orgRepo.create({ name: 'Org 2', shortName: 'org2', shadowBanThreshold: 5 });

  const { token: superToken, user: superadmin } = await registerHandler({ firstName: 'Super', lastName: 'X', email: 's@a.com', password: '123' }, org1.id, io);
  await io.userRepo.update(superadmin.id, { role: 'Superadmin' });

  const { token: admin1Token, user: admin1 } = await registerHandler({ firstName: 'A1', lastName: 'X', email: 'a1@a.com', password: '123' }, org1.id, io);
  await io.userRepo.update(admin1.id, { role: 'Admin' });

  const { token: admin2Token, user: admin2 } = await registerHandler({ firstName: 'A2', lastName: 'X', email: 'a2@a.com', password: '123' }, org2.id, io);
  await io.userRepo.update(admin2.id, { role: 'Admin' });

  const { token: memberToken, user: member } = await registerHandler({ firstName: 'M', lastName: 'X', email: 'm@a.com', password: '123' }, org1.id, io);

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
    const d = await connectDeviceHandler({ identifier: 'mac-1' }, io);

    await approveDeviceHandler(sReq, d.id, { name: 'Main Hall', location: 'Floor 1', organizationId: org1 }, io);

    const active = await getDeviceHandler(sReq, org1, d.id, io);
    assert.equal(active.status, 'active');
    assert.equal(active.name, 'Main Hall');
    assert.equal(active.location, 'Floor 1');
    assert.equal(active.organizationId, org1);
  });

  await t.test('org Admin approves device that identified their org → device becomes active', async () => {
    const { io, org1, a1Req } = await setup();
    const d = await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);

    await approveDeviceHandler(a1Req, d.id, { name: 'Room 2', location: 'Floor 2' }, io);

    const active = await getDeviceHandler(a1Req, org1, d.id, io);
    assert.equal(active.status, 'active');
  });

  await t.test('org Admin cannot approve a device that belongs to another org queue', async () => {
    const { io, org1, org2, a2Req } = await setup();
    const d = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);

    await assert.rejects(
      approveDeviceHandler(a2Req, d.id, { name: 'X', location: 'Y' }, io),
      /FORBIDDEN/
    );
  });

  await t.test('rejected device is excluded from pending and active lists', async () => {
    const { io, org1, a1Req } = await setup();
    const d = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);

    await rejectDeviceHandler(a1Req, d.id, io);

    const pending = await listPendingDevicesOrgHandler(a1Req, org1, io);
    assert.equal(pending.length, 0);

    const active = await listActiveDevicesOrgHandler(a1Req, org1, io);
    assert.equal(active.length, 0);
  });

  await t.test('list enrolled devices returns only active devices for the org', async () => {
    const { io, org1, a1Req } = await setup();
    const d1 = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org1 }, io);
    const d2 = await connectDeviceHandler({ identifier: 'mac-2', organizationId: org1 }, io);

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
    const d = await connectDeviceHandler({ identifier: 'mac-1' }, io);
    
    assert.equal(d.name, undefined);
    assert.equal(d.location, undefined);
    assert.equal(d.status, 'pending');
  });
});
