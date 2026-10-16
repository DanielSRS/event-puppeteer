import type { AppIO } from '../io/index.ts';
import type { DeviceTelemetry, PostLogInput } from '../types/telemetry.ts';
import type { Command, CreateCommandInput, RequestUpdateUploadInput, UpdateUploadGrantView } from '../types/command.ts';
import { UPDATE_BINARY_CONTENT_TYPE, UPDATE_BINARY_MAX_BYTES, UpdateBinaryPrefix } from '../types/command.ts';

/** How long the download URL handed to a Device lives: enough for 64 MiB over a slow link. */
const DOWNLOAD_URL_LIFETIME_MS = 60 * 60 * 1000;
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

  // At-least-once: 'sent' commands are redelivered until the device acks them,
  // so a lost response or ack doesn't strand a command
  const undelivered = (await io.commandRepo.listByDevice(deviceId))
    .filter(c => c.status === 'pending' || c.status === 'sent')
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

  const sent = [];
  for (const command of undelivered) {
    const updated = command.status === 'pending' ? await io.commandRepo.updateStatus(command.id, 'sent') : command;
    if (!updated) continue;
    const delivered = await withDownloadUrl(updated, io);
    if (delivered === null) continue;
    sent.push(delivered);
  }
  return sent;
}

/**
 * The Command as the Device must see it. An update Command of an uploaded binary stores a
 * pathname; here it becomes `{ url, sha256, version }` with a URL signed for the next hour,
 * so a Device that was offline for days still finds a valid link. When the store cannot
 * sign, the Command is marked failed (and left out) instead of blocking the rest of the queue.
 * @returns null when the Command was marked failed.
 */
async function withDownloadUrl(command: Command, io: AppIO): Promise<Command | null> {
  const payload = command.payload;
  if (command.type !== 'update' || payload === undefined || typeof payload.blobPathname !== 'string') return command;

  const signed = await io.updateBinaryStore.signedDownloadUrl(payload.blobPathname, Date.now() + DOWNLOAD_URL_LIFETIME_MS);
  if (!signed.ok) {
    await io.commandRepo.updateStatus(command.id, 'failed');
    return null;
  }
  const { blobPathname: _stored, ...rest } = payload;
  return { ...command, payload: { url: signed.value, ...rest } };
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
  if (body.type === 'update' && 'blobPathname' in body.payload && (!body.payload.blobPathname.startsWith(UpdateBinaryPrefix(orgId)) || body.payload.blobPathname.includes('..'))) throw new Error('BAD_REQUEST');

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

/**
 * Authorizes the browser of an Admin of the Organization to upload one update binary
 * straight to the store, so it can then send an `update` Command pointing at the result.
 * The name is chosen here, not by the caller, so nobody can pick another file's name.
 * @throws UPDATE_STORE_FAILED:<reason> when the store refuses to issue the grant.
 */
export async function requestUpdateUploadHandler(request: Request, orgId: string, body: RequestUpdateUploadInput, io: AppIO): Promise<UpdateUploadGrantView> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  if (body.sizeBytes > UPDATE_BINARY_MAX_BYTES) throw new Error('BAD_REQUEST');

  const granted = await io.updateBinaryStore.issueUploadGrant(`${UpdateBinaryPrefix(orgId)}${randomUUID()}`, UPDATE_BINARY_MAX_BYTES);
  if (!granted.ok) throw new Error(`UPDATE_STORE_FAILED: ${granted.error}`);
  return { ...granted.value, contentType: UPDATE_BINARY_CONTENT_TYPE, maxBytes: UPDATE_BINARY_MAX_BYTES };
}
