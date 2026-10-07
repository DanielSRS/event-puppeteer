import type { AppIO } from '../io/index.ts';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../types/organization.ts';

export async function createOrganizationHandler(body: CreateOrganizationInput, io: AppIO) {
  const orgData = {
    ...body,
    shadowBanThreshold: body.shadowBanThreshold ?? 5
  };
  return await io.orgRepo.create(orgData);
}

export async function getOrganizationHandler(id: string, io: AppIO) {
  return await io.orgRepo.getById(id);
}

export async function listOrganizationsHandler(io: AppIO) {
  return await io.orgRepo.getAll();
}

export async function updateOrganizationHandler(id: string, body: UpdateOrganizationInput, io: AppIO) {
  return await io.orgRepo.update(id, body);
}
