import type { AppIO } from '../io/index.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';
import type { CreateOrganizationInput, Organization, OrganizationView, UpdateOrganizationInput } from '../types/organization.ts';
import { imageViewFor } from './images.ts';

/**
 * Creates an Organization. Superadmin only.
 * @throws FORBIDDEN when the actor is not a Superadmin.
 * @throws ORGANIZATION_SLUG_EXISTS when another Organization already uses the slug.
 */
export async function createOrganizationHandler(request: Request, body: CreateOrganizationInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');
  if (await io.orgRepo.findBySlug(body.slug)) throw new Error('ORGANIZATION_SLUG_EXISTS');

  const now = new Date().toISOString();
  const orgData = {
    ...body,
    shadowBanThreshold: body.shadowBanThreshold ?? 5,
    createdAt: now,
    updatedAt: now
  };
  return await io.orgRepo.create(orgData);
}

/**
 * Gets an Organization, with its logo as the viewer sees it. Public: kiosks and visitors
 * read the branding without a session.
 * @returns null for an unknown Organization.
 */
export async function getOrganizationHandler(request: Request, id: string, io: AppIO): Promise<OrganizationView | null> {
  const org = await io.orgRepo.getById(id);
  if (!org) return null;
  return await withLogo(org, await io.auth.getSessionUserId(request), io);
}

/** The Organization with its logo resolved for `viewerId` (absent when it never had one). */
async function withLogo(org: Organization, viewerId: string | null, io: AppIO): Promise<OrganizationView> {
  const logo = await imageViewFor('organization_logo', org.id, viewerId, io);
  return { ...org, ...(logo ? { logo } : {}) };
}

export async function listOrganizationsHandler(request: Request, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');
  return await Promise.all((await io.orgRepo.getAll()).map(org => withLogo(org, actor.id, io)));
}

import { randomUUID } from 'node:crypto';

/**
 * Updates an Organization. Admin of the Organization, or Superadmin. Changing the
 * shadow-ban threshold is recorded in the audit trail.
 * @throws FORBIDDEN when the actor may not manage the Organization.
 * @throws ORGANIZATION_SLUG_EXISTS when the new slug belongs to another Organization.
 * @returns null when the Organization doesn't exist.
 */
export async function updateOrganizationHandler(request: Request, id: string, body: UpdateOrganizationInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, id, 'Admin');
  if (body.slug !== undefined) {
    const owner = await io.orgRepo.findBySlug(body.slug);
    if (owner && owner.id !== id) throw new Error('ORGANIZATION_SLUG_EXISTS');
  }

  const updated = await io.orgRepo.update(id, { ...body, updatedAt: new Date().toISOString() });
  
  if (updated && body.shadowBanThreshold !== undefined) {
    await io.auditRepo.create({
      id: randomUUID(),
      actorId: actor.id,
      organizationId: id,
      action: 'update_org_threshold',
      targetType: 'organization',
      targetId: id,
      details: { shadowBanThreshold: body.shadowBanThreshold },
      createdAt: new Date().toISOString()
    });
  }

  return updated ? await withLogo(updated, actor.id, io) : null;
}
