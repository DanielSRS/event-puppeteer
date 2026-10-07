import test from 'node:test';
import assert from 'node:assert/strict';
import { registerVerified } from '../test-support.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { connectDeviceHandler, approveDeviceHandler } from './devices.ts';
import { heartbeatHandler, postLogHandler, postTelemetryHandler, ackCommandHandler, completeCommandHandler, getDeviceStatusHandler, getDeviceLogsHandler, getDetailedTelemetryHandler, sendCommandHandler, requestTelemetryHandler, listCommandsHandler, pullPendingCommandsHandler } from './telemetry.ts';

async function setup() {
  const io = await createInMemoryIO();
  const org = await io.orgRepo.create({ name: 'Org', slug: 'org', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), shadowBanThreshold: 5 });
  
  const { token: adminToken, user: admin } = await registerVerified({ firstName: 'A', lastName: 'X', email: 'a@a.com', password: 'password123' }, org.id, io);
  await io.userRepo.update(admin.id, { role: 'Admin' });

  const { token: memberToken, user: member } = await registerVerified({ firstName: 'M', lastName: 'X', email: 'm@a.com', password: 'password123' }, org.id, io);

  const adminReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${adminToken}` } });
  const memberReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${memberToken}` } });

  const { device, token: devToken } = await connectDeviceHandler({ identifier: 'mac-1', organizationId: org.id }, io);
  await approveDeviceHandler(adminReq, device.id, { name: 'D1', location: 'L1', organizationId: org.id }, io);

  const devReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${devToken}` } });

  return { io, orgId: org.id, adminReq, memberReq, devReq, device };
}

test('Telemetry & Command Handlers', async (t) => {
  await t.test('device sends heartbeat → latest heartbeat stored and device shows as online', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    await heartbeatHandler(devReq, device.id, 'ok', undefined, io);

    const { isOnline, latestHeartbeat } = await getDeviceStatusHandler(adminReq, orgId, device.id, io);
    assert.equal(isOnline, true);
    assert.equal(latestHeartbeat?.status, 'ok');
  });

  await t.test('no heartbeat for configured interval → device shows as offline', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    
    // Insert a heartbeat in the past
    await io.telemetryRepo.recordHeartbeat({
      deviceId: device.id,
      status: 'ok',
      timestamp: new Date('2000-01-01T00:00:00Z').toISOString()
    });

    const { isOnline } = await getDeviceStatusHandler(adminReq, orgId, device.id, io);
    assert.equal(isOnline, false);
  });

  await t.test('device sends logs → logs are queryable by admin', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    await postLogHandler(devReq, device.id, { level: 'error', message: 'crash' }, io);

    const logs = await getDeviceLogsHandler(adminReq, orgId, device.id, io);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.message, 'crash');
  });

  await t.test('admin requests detailed telemetry → request recorded for device to pick up', async () => {
    const { io, orgId, adminReq, device } = await setup();
    const cmd = await requestTelemetryHandler(adminReq, orgId, device.id, io);
    
    assert.equal(cmd.type, 'request_telemetry');
    assert.equal(cmd.status, 'pending');

    const commands = await listCommandsHandler(adminReq, orgId, device.id, io);
    assert.ok(commands.find(c => c.id === cmd.id));
  });

  await t.test('device submits detailed telemetry → latest telemetry queryable by admin', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    await postTelemetryHandler(devReq, device.id, { cpuTemp: 45, memoryUsage: 80 }, io);

    const telemetry = await getDetailedTelemetryHandler(adminReq, orgId, device.id, io);
    assert.equal(telemetry?.cpuTemp, 45);
  });

  await t.test('admin sends restart command → command created with pending status', async () => {
    const { io, orgId, adminReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);
    assert.equal(cmd.status, 'pending');
    assert.equal(cmd.type, 'restart');
  });

  await t.test('device acknowledges command → status changes to acknowledged', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);
    
    await ackCommandHandler(devReq, device.id, cmd.id, io);
    
    const cmds = await listCommandsHandler(adminReq, orgId, device.id, io);
    assert.equal(cmds[0]!.status, 'acknowledged');
  });

  await t.test('device completes command → status changes to completed', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);
    
    await completeCommandHandler(devReq, device.id, cmd.id, true, io);
    
    const cmds = await listCommandsHandler(adminReq, orgId, device.id, io);
    assert.equal(cmds[0]!.status, 'completed');
  });

  await t.test('Member cannot send commands or view telemetry (forbidden)', async () => {
    const { io, orgId, memberReq, device } = await setup();
    await assert.rejects(getDetailedTelemetryHandler(memberReq, orgId, device.id, io), /FORBIDDEN/);
    await assert.rejects(sendCommandHandler(memberReq, orgId, device.id, { type: 'restart' }, io), /FORBIDDEN/);
  });

  await t.test('device pulls pending commands oldest first and they become sent', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    const admin = (await io.userRepo.listByOrganization(orgId)).find(u => u.role === 'Admin')!;
    await io.commandRepo.create({ id: 'newer', deviceId: device.id, type: 'shutdown', status: 'pending', issuedBy: admin.id, issuedAt: '2026-01-02T00:00:00.000Z' });
    await io.commandRepo.create({ id: 'older', deviceId: device.id, type: 'restart', status: 'pending', issuedBy: admin.id, issuedAt: '2026-01-01T00:00:00.000Z' });

    const pulled = await pullPendingCommandsHandler(devReq, device.id, io);
    assert.deepEqual(pulled.map(c => c.id), ['older', 'newer']);
    assert.ok(pulled.every(c => c.status === 'sent'));

    const cmds = await listCommandsHandler(adminReq, orgId, device.id, io);
    assert.ok(cmds.every(c => c.status === 'sent'));
  });

  await t.test('unacknowledged commands are redelivered until the device acks them', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);

    assert.deepEqual((await pullPendingCommandsHandler(devReq, device.id, io)).map(c => c.id), [cmd.id]);
    // Response or ack lost: the next poll delivers it again
    assert.deepEqual((await pullPendingCommandsHandler(devReq, device.id, io)).map(c => c.id), [cmd.id]);

    await ackCommandHandler(devReq, device.id, cmd.id, io);
    assert.deepEqual(await pullPendingCommandsHandler(devReq, device.id, io), []);
  });

  await t.test('device cannot pull another device\'s commands', async () => {
    const { io, devReq } = await setup();
    const { device: other } = await connectDeviceHandler({ identifier: 'mac-2' }, io);
    await assert.rejects(pullPendingCommandsHandler(devReq, other.id, io), /FORBIDDEN/);
  });

  await t.test('pending device pulls no commands', async () => {
    const { io } = await setup();
    const { device, token } = await connectDeviceHandler({ identifier: 'mac-2' }, io);
    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    assert.deepEqual(await pullPendingCommandsHandler(req, device.id, io), []);
  });

  await t.test('device cannot ack or complete another device\'s command', async () => {
    const { io, orgId, adminReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);
    const { device: other, token } = await connectDeviceHandler({ identifier: 'mac-2' }, io);
    const otherReq = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });

    await assert.rejects(ackCommandHandler(otherReq, other.id, cmd.id, io), /NOT_FOUND/);
    await assert.rejects(completeCommandHandler(otherReq, other.id, cmd.id, true, io), /NOT_FOUND/);
    assert.equal((await io.commandRepo.getById(cmd.id))?.status, 'pending');
  });
});
