import type { AppIO } from '../io/index.ts';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../types/organization.ts';

export async function createOrganizationHandler(body: CreateOrganizationInput, io: AppIO) {
  const now = new Date().toISOString();
  const orgData = {
    ...body,
    shadowBanThreshold: body.shadowBanThreshold ?? 5,
    createdAt: now,
    updatedAt: now
  };
  return await io.orgRepo.create(orgData);
}

export async function getOrganizationHandler(id: string, io: AppIO) {
  return await io.orgRepo.getById(id);
}

export async function listOrganizationsHandler(io: AppIO) {
  return await io.orgRepo.getAll();
}

import { randomUUID } from 'node:crypto';

export async function updateOrganizationHandler(id: string, body: UpdateOrganizationInput, io: AppIO) {
  const updated = await io.orgRepo.update(id, { ...body, updatedAt: new Date().toISOString() });
  
  if (updated && body.shadowBanThreshold !== undefined) {
    await io.auditRepo.create({
      id: randomUUID(),
      organizationId: id,
      action: 'update_org_threshold',
      targetType: 'organization',
      targetId: id,
      details: { shadowBanThreshold: body.shadowBanThreshold },
      createdAt: new Date().toISOString()
    });
  }

  return updated;
}
