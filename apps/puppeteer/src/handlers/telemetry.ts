import type { AppIO } from '../io/index.ts';
import type { DeviceTelemetry, PostLogInput } from '../types/telemetry.ts';
import type { CreateCommandInput } from '../types/command.ts';
import { requireDeviceAuth } from './devices.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';
import { randomUUID } from 'node:crypto';

// DEVICE HANDLERS
export async function heartbeatHandler(request: Request, deviceId: string, status: string, errors: string[] | undefined, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');

  await io.telemetryRepo.recordHeartbeat({
    deviceId,
    timestamp: new Date().toISOString(),
    status,
    ...(errors !== undefined ? { errors } : {})
  });
  return { success: true };
}

export async function postLogHandler(request: Request, deviceId: string, body: PostLogInput, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');

  await io.telemetryRepo.recordLog({
    id: randomUUID(),
    deviceId,
    level: body.level,
    message: body.message,
    timestamp: new Date().toISOString()
  });
  return { success: true };
}

export async function postTelemetryHandler(request: Request, deviceId: string, body: DeviceTelemetry, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');

  await io.telemetryRepo.saveDetailedTelemetry(deviceId, body);

  // Complete any pending telemetry request command
  const commands = await io.commandRepo.listByDevice(deviceId);
  const pendingRequest = commands.find(c => c.type === 'request_telemetry' && (c.status === 'pending' || c.status === 'sent'));
  if (pendingRequest) {
    await io.commandRepo.updateStatus(pendingRequest.id, 'completed');
  }

  return { success: true };
}

export async function ackCommandHandler(request: Request, deviceId: string, commandId: string, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');

  await requireDeviceCommand(deviceId, commandId, io);
  const updated = await io.commandRepo.updateStatus(commandId, 'acknowledged');
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function completeCommandHandler(request: Request, deviceId: string, commandId: string, success: boolean, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');

  await requireDeviceCommand(deviceId, commandId, io);
  const updated = await io.commandRepo.updateStatus(commandId, success ? 'completed' : 'failed');
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function pullPendingCommandsHandler(request: Request, deviceId: string, io: AppIO) {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');
  if (device.status !== 'active') return [];

  const pending = (await io.commandRepo.listByDevice(deviceId))
    .filter(c => c.status === 'pending')
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

  // Mark as sent so the next poll doesn't redeliver them
  const sent = [];
  for (const command of pending) {
    const updated = await io.commandRepo.updateStatus(command.id, 'sent');
    if (updated) sent.push(updated);
  }
  return sent;
}

async function requireDeviceCommand(deviceId: string, commandId: string, io: AppIO) {
  const command = await io.commandRepo.getById(commandId);
  if (!command || command.deviceId !== deviceId) throw new Error('NOT_FOUND');
  return command;
}

// ADMIN HANDLERS
export async function getDeviceStatusHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');

  const latestHeartbeat = await io.telemetryRepo.getLatestHeartbeat(deviceId);
  let isOnline = false;
  if (latestHeartbeat) {
    const msSinceHeartbeat = Date.now() - new Date(latestHeartbeat.timestamp).getTime();
    if (msSinceHeartbeat < 60000) { // 60 seconds threshold
      isOnline = true;
    }
  }

  return { isOnline, latestHeartbeat };
}

export async function getDeviceLogsHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');

  return await io.telemetryRepo.getDeviceLogs(deviceId);
}

export async function getDetailedTelemetryHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');

  return await io.telemetryRepo.getLatestTelemetry(deviceId);
}

export async function sendCommandHandler(request: Request, orgId: string, deviceId: string, body: CreateCommandInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');

  const command = await io.commandRepo.create({
    id: randomUUID(),
    deviceId,
    type: body.type,
    ...(body.payload ? { payload: body.payload } : {}),
    status: 'pending',
    issuedBy: actor.id,
    issuedAt: new Date().toISOString()
  });
  return command;
}

export async function requestTelemetryHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  return await sendCommandHandler(request, orgId, deviceId, { type: 'request_telemetry' }, io);
}

export async function listCommandsHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');

  return await io.commandRepo.listByDevice(deviceId);
}
