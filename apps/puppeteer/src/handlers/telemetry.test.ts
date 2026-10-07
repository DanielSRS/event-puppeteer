import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryIO } from '../io/in-memory.ts';
import { connectDeviceHandler, approveDeviceHandler } from './devices.ts';
import { registerHandler } from './auth.ts';
import { heartbeatHandler, postLogHandler, postTelemetryHandler, ackCommandHandler, completeCommandHandler, getDeviceStatusHandler, getDeviceLogsHandler, getDetailedTelemetryHandler, sendCommandHandler, requestTelemetryHandler, listCommandsHandler } from './telemetry.ts';

async function setup() {
  const io = createInMemoryIO();
  const org = await io.orgRepo.create({ name: 'Org', shortName: 'org', shadowBanThreshold: 5 });
  
  const { token: adminToken, user: admin } = await registerHandler({ firstName: 'A', lastName: 'X', email: 'a@a.com', password: '123' }, org.id, io);
  await io.userRepo.update(admin.id, { role: 'Admin' });

  const { token: memberToken, user: member } = await registerHandler({ firstName: 'M', lastName: 'X', email: 'm@a.com', password: '123' }, org.id, io);

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
    await heartbeatHandler(devReq, device.id, 'ok', undefined, io);

    // Manually backdate the heartbeat
    const hbs = await io.telemetryRepo.getHeartbeatHistory(device.id);
    hbs[0].timestamp = new Date(Date.now() - 65000).toISOString();

    const { isOnline } = await getDeviceStatusHandler(adminReq, orgId, device.id, io);
    assert.equal(isOnline, false);
  });

  await t.test('device sends logs → logs are queryable by admin', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    await postLogHandler(devReq, device.id, { level: 'error', message: 'crash' }, io);

    const logs = await getDeviceLogsHandler(adminReq, orgId, device.id, io);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].message, 'crash');
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
    assert.equal(cmds[0].status, 'acknowledged');
  });

  await t.test('device completes command → status changes to completed', async () => {
    const { io, orgId, adminReq, devReq, device } = await setup();
    const cmd = await sendCommandHandler(adminReq, orgId, device.id, { type: 'restart' }, io);
    
    await completeCommandHandler(devReq, device.id, cmd.id, true, io);
    
    const cmds = await listCommandsHandler(adminReq, orgId, device.id, io);
    assert.equal(cmds[0].status, 'completed');
  });

  await t.test('Member cannot send commands or view telemetry (forbidden)', async () => {
    const { io, orgId, memberReq, device } = await setup();
    await assert.rejects(getDetailedTelemetryHandler(memberReq, orgId, device.id, io), /FORBIDDEN/);
    await assert.rejects(sendCommandHandler(memberReq, orgId, device.id, { type: 'restart' }, io), /FORBIDDEN/);
  });
});
