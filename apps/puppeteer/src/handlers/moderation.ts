import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { CreateReportInput, AuditAction } from '../types/moderation.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';

async function logAudit(io: AppIO, actorId: string, orgId: string, action: AuditAction, targetType: string, targetId: string, details?: Record<string, any>) {
  await io.auditRepo.create({
    id: randomUUID(),
    actorId,
    organizationId: orgId,
    action,
    targetType,
    targetId,
    ...(details !== undefined ? { details } : {}),
    createdAt: new Date().toISOString()
  });
}

export async function reportEventHandler(request: Request, orgId: string, eventId: string, body: CreateReportInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) {
    throw new Error('NOT_FOUND');
  }

  const hasReported = await io.reportRepo.existsByUserAndEvent(actor.id, eventId);
  if (hasReported) {
    throw new Error('BAD_REQUEST'); // one report per user per event
  }

  const report = await io.reportRepo.create({
    id: randomUUID(),
    reporterId: actor.id,
    eventId: eventId,
    reason: body.reason,
    ...(body.comment !== undefined ? { comment: body.comment } : {}),
    createdAt: new Date().toISOString()
  });

  // Check shadow ban threshold
  const org = await io.orgRepo.getById(orgId);
  const threshold = org?.shadowBanThreshold ?? 5;
  const uniqueReporters = await io.reportRepo.countUniqueReportersByEvent(eventId);

  if (uniqueReporters >= threshold) {
    // hide event and shadow ban creator automatically
    const creator = await io.userRepo.getById(event.creatorId);
    if (creator && !creator.isShadowBanned) {
      await io.userRepo.update(creator.id, { isShadowBanned: true });
      await logAudit(io, null, orgId, 'apply_shadow_ban', 'user', creator.id, { reason: 'auto_threshold_reached', eventId });
    }
    if (!event.isHidden) {
      await io.eventRepo.update(eventId, { isHidden: true });
      await logAudit(io, null, orgId, 'hide_event', 'event', eventId, { reason: 'auto_threshold_reached' });
    }
  }

  return report;
}

export async function listReportsHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');
  return await io.reportRepo.listByOrganization(orgId);
}

export async function hideEventHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');

  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId) throw new Error('NOT_FOUND');

  const updated = await io.eventRepo.update(eventId, { isHidden: true });
  await logAudit(io, actor.id, orgId, 'hide_event', 'event', eventId);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function unhideEventHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');

  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId) throw new Error('NOT_FOUND');

  const updated = await io.eventRepo.update(eventId, { isHidden: false });
  await logAudit(io, actor.id, orgId, 'unhide_event', 'event', eventId);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function listShadowBansHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');

  const users = await io.userRepo.listByOrganization(orgId);
  return users.filter(u => u.isShadowBanned);
}

export async function liftShadowBanHandler(request: Request, orgId: string, userId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');

  const target = await io.userRepo.getById(userId);
  if (!target || target.organizationId !== orgId) throw new Error('NOT_FOUND');

  const updated = await io.userRepo.update(userId, { isShadowBanned: false });
  await logAudit(io, actor.id, orgId, 'lift_shadow_ban', 'user', userId);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function promoteTagHandler(request: Request, tagId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  // Tag promotion is usually a Superadmin action or Admin depending on domain, but spec says Moderator+ only
  // Wait, the spec says `POST /tags/:tagId/promote` — Moderator+ only
  // However, tags are system-wide. A moderator of *any* org can promote?
  // Let's assume Moderator+ requirement implies they must be at least a Moderator in their own org, or Superadmin.
  if (actor.role === 'Member') throw new Error('FORBIDDEN');

  const tag = await io.tagRepo.getById(tagId);
  if (!tag) throw new Error('NOT_FOUND');

  const updated = await io.tagRepo.update(tagId, { isSystemDefined: true });
  await logAudit(io, actor.id, actor.organizationId, 'promote_tag', 'tag', tagId);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function listAuditTrailHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  return await io.auditRepo.listByOrganization(orgId);
}
