import type { AppIO } from '../io/index.ts';
import type { ConnectDeviceInput, ApproveDeviceInput } from '../types/device.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';

export async function connectDeviceHandler(body: ConnectDeviceInput, io: AppIO) {
  return await io.deviceRepo.create({
    ...(body.organizationId ? { organizationId: body.organizationId } : {}),
    status: 'pending',
    connectedAt: new Date().toISOString()
  });
}

export async function listPendingDevicesGlobalHandler(request: Request, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');
  return await io.deviceRepo.listPendingWithoutOrg();
}

export async function listPendingDevicesOrgHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  return await io.deviceRepo.listPendingByOrg(orgId);
}

export async function listActiveDevicesOrgHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  
  const devices = await io.deviceRepo.listByOrganization(orgId);
  return devices.filter(d => d.status === 'active');
}

export async function getDeviceHandler(request: Request, orgId: string, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const device = await io.deviceRepo.getById(deviceId);
  if (!device || device.organizationId !== orgId) throw new Error('NOT_FOUND');
  return device;
}

export async function approveDeviceHandler(request: Request, deviceId: string, body: ApproveDeviceInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  
  const device = await io.deviceRepo.getById(deviceId);
  if (!device) throw new Error('NOT_FOUND');
  if (device.status !== 'pending') throw new Error('BAD_REQUEST');

  const targetOrgId = body.organizationId || device.organizationId;
  if (!targetOrgId) throw new Error('BAD_REQUEST'); // Need org to approve

  if (actor.role !== 'Superadmin') {
    assertCanManageOrg(actor, targetOrgId, 'Admin');
    if (device.organizationId && device.organizationId !== targetOrgId) {
      throw new Error('FORBIDDEN'); // Admin cannot approve another org's device
    }
  }

  const updated = await io.deviceRepo.update(deviceId, {
    name: body.name,
    location: body.location,
    organizationId: targetOrgId,
    status: 'active',
    approvedAt: new Date().toISOString(),
    approvedBy: actor.id
  });

  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function rejectDeviceHandler(request: Request, deviceId: string, io: AppIO) {
  const actor = await requireAuth(request, io);

  const device = await io.deviceRepo.getById(deviceId);
  if (!device) throw new Error('NOT_FOUND');
  if (device.status !== 'pending') throw new Error('BAD_REQUEST');

  if (actor.role !== 'Superadmin') {
    if (!device.organizationId) throw new Error('FORBIDDEN');
    assertCanManageOrg(actor, device.organizationId, 'Admin');
  }

  const updated = await io.deviceRepo.update(deviceId, { status: 'rejected' });
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}
