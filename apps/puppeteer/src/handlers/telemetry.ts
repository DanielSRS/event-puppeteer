import type { AppIO } from '../io/index.ts';
import type { DeviceTelemetry, PostLogInput } from '../types/telemetry.ts';
import type { Command, CreateCommandInput, IssuedCommand, WakeupOutcome, RequestUpdateUploadInput, UpdateUploadGrantView } from '../types/command.ts';
import { UPDATE_BINARY_CONTENT_TYPE, UPDATE_BINARY_MAX_BYTES, UpdateBinaryPrefix } from '../types/command.ts';

/** How long a signed download URL lives. The download starts as soon as it is answered, and a started download is not cut off. */
const DOWNLOAD_URL_LIFETIME_MS = 10 * 60 * 1000;
import { requireDeviceAuth } from './devices.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';
import { UpdateBinaryDownloadPath } from '../types/command.ts';
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
  return { success: true, commandsWaiting: await io.commandRepo.hasWaiting(deviceId) };
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
    sent.push(withDownloadPath(updated));
  }
  return sent;
}

/**
 * The Command as the Device must see it. An update Command of an uploaded binary stores a
 * pathname; the Device receives `{ url, sha256, version }` where `url` is a short path on
 * Puppeteer (Puppet keeps the address in 512 bytes, far less than a signed Blob URL) that
 * {@link downloadUpdateBinaryHandler} answers with a redirect to a freshly signed URL.
 */
function withDownloadPath(command: Command): Command {
  const payload = command.payload;
  if (command.type !== 'update' || payload === undefined || typeof payload.blobPathname !== 'string') return command;

  const { blobPathname: _stored, ...rest } = payload;
  return { ...command, payload: { url: UpdateBinaryDownloadPath(command.deviceId, command.id), ...rest } };
}

/**
 * Where a Device downloads the binary of an uploaded update: answers the URL to redirect to,
 * signed for a few minutes at the moment of the download, so a Device that was offline for
 * days still finds a valid link. Only the Device the Command was sent to may ask.
 * @throws UPDATE_STORE_FAILED:<reason> when the store cannot sign.
 */
export async function downloadUpdateBinaryHandler(request: Request, deviceId: string, commandId: string, io: AppIO): Promise<string> {
  const device = await requireDeviceAuth(request, io);
  if (device.id !== deviceId) throw new Error('FORBIDDEN');
  const command = await requireDeviceCommand(deviceId, commandId, io);
  const pathname = command.payload?.blobPathname;
  if (command.type !== 'update' || typeof pathname !== 'string' || (command.status !== 'sent' && command.status !== 'acknowledged')) throw new Error('NOT_FOUND');

  const signed = await io.updateBinaryStore.signedDownloadUrl(pathname, Date.now() + DOWNLOAD_URL_LIFETIME_MS);
  if (!signed.ok) throw new Error(`UPDATE_STORE_FAILED: ${signed.error}`);
  return signed.value;
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

/** Topic a Device listens on for Wake-ups: its id and its Organization's id (ADR-0001). */
function wakeupTopic(deviceId: string, organizationId: string): string {
  return `${deviceId}/${organizationId}`;
}

/**
 * Stores a Command for the Device and publishes its Wake-up. A failed Wake-up is reported in the
 * answer and logged, but never fails the request or removes the Command.
 */
export async function sendCommandHandler(request: Request, orgId: string, deviceId: string, body: CreateCommandInput, io: AppIO): Promise<IssuedCommand> {
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

  return { ...command, wakeup: await publishWakeup(orgId, command, io) };
}

/**
 * Publishes the Wake-up of a Command and logs the attempt. The outcome is a value: a failed
 * publish is reported, never thrown.
 */
async function publishWakeup(orgId: string, command: Command, io: AppIO): Promise<WakeupOutcome> {
  const startedAt = performance.now();
  const published = await io.wakeupPublisher.publish(wakeupTopic(command.deviceId, orgId));
  console.log(JSON.stringify({
    event: 'wakeup.publish',
    deviceId: command.deviceId,
    organizationId: orgId,
    commandId: command.id,
    sent: published.ok,
    ...(published.ok ? {} : { reason: published.error }),
    durationMs: Math.round(performance.now() - startedAt)
  }));
  return published.ok ? { sent: true } : { sent: false, reason: published.error };
}

/**
 * Publishes the Wake-up again for a Command the Device has not acknowledged yet.
 * @throws NOT_FOUND when the Device is not in the Organization or the Command is not the Device's.
 * @throws COMMAND_NOT_RESENDABLE when the Command is acknowledged, completed or failed.
 */
export async function resendWakeupHandler(request: Request, orgId: string, deviceId: string, commandId: string, io: AppIO): Promise<WakeupOutcome> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');
  const command = await requireDeviceCommand(deviceId, commandId, io);
  if (command.status !== 'pending' && command.status !== 'sent') throw new Error('COMMAND_NOT_RESENDABLE');

  return await publishWakeup(orgId, command, io);
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
