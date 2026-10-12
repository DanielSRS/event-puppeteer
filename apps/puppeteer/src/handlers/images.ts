import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import { SCREENING_CATEGORIES, type Image, type ImageKind, type ImageReviewItem, type ImageView, type ScreeningPolicy } from '../types/image.ts';
import { organizationOf, type User } from '../types/user.ts';
import { hasAtLeastRole } from '../utils/roles.ts';
import { prepareImage, MAX_UPLOAD_BYTES, type ImageRefusal } from '../images/prepare.ts';
import { verdictFor } from '../images/verdict.ts';
import { requireAuth, assertCanManageOrg } from './users.ts';
import { logAudit } from './moderation.ts';

/**
 * Reads the Screening Policy. Superadmin only.
 * @returns null until a Superadmin sets it; meanwhile every Image waits in Image Review.
 * @throws FORBIDDEN when the actor is not a Superadmin.
 */
export async function getScreeningPolicyHandler(request: Request, io: AppIO): Promise<ScreeningPolicy | null> {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');
  return await io.screeningPolicyRepo.get();
}

/**
 * Replaces the Screening Policy. Superadmin only. Recorded in the Audit Trail. Images
 * already screened keep their state.
 * @throws FORBIDDEN when the actor is not a Superadmin.
 * @throws SCREENING_POLICY_INVALID when a cut-off is outside 0–1 or a lower cut-off is above its upper one.
 */
export async function setScreeningPolicyHandler(request: Request, policy: ScreeningPolicy, io: AppIO): Promise<ScreeningPolicy> {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');
  const coherent = SCREENING_CATEGORIES.every(category => {
    const cutOffs = policy[category];
    return cutOffs !== undefined && 0 <= cutOffs.lower && cutOffs.lower <= cutOffs.upper && cutOffs.upper <= 1;
  });
  if (!coherent) throw new Error('SCREENING_POLICY_INVALID');

  await io.screeningPolicyRepo.set(policy);
  await logAudit(io, actor.id, undefined, 'update_screening_policy', 'screening_policy', 'screening_policy', { policy });
  return policy;
}

/**
 * Uploads a new banner for an Event. Event creator only.
 * @returns the banner as its uploader sees it.
 * @throws NOT_FOUND when the Event doesn't exist, belongs to another Organization or is deleted.
 */
export async function uploadEventBannerHandler(request: Request, orgId: string, eventId: string, file: Blob, io: AppIO): Promise<ImageView> {
  const actor = await requireAuth(request, io);
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) throw new Error('NOT_FOUND');
  if (event.creatorId !== actor.id) throw new Error('FORBIDDEN');
  return await uploadImage('event_banner', eventId, orgId, actor.id, file, io);
}

/**
 * Removes an Event's banner: none of its Images is shown again, to anyone. Event creator only.
 * @throws NOT_FOUND when the Event doesn't exist, belongs to another Organization or is deleted.
 * @throws FORBIDDEN when the actor is not the Event's creator.
 */
export async function removeEventBannerHandler(request: Request, orgId: string, eventId: string, io: AppIO): Promise<void> {
  const actor = await requireAuth(request, io);
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) throw new Error('NOT_FOUND');
  if (event.creatorId !== actor.id) throw new Error('FORBIDDEN');
  await io.imageRepo.detachAll('event_banner', eventId, new Date());
}

/**
 * Uploads a new logo for an Organization. Admin of the Organization, or Superadmin.
 * @returns the logo as its uploader sees it.
 * @throws NOT_FOUND for an unknown Organization.
 * @throws FORBIDDEN when the actor may not manage the Organization.
 */
export async function uploadOrganizationLogoHandler(request: Request, orgId: string, file: Blob, io: AppIO): Promise<ImageView> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  if (!await io.orgRepo.getById(orgId)) throw new Error('NOT_FOUND');
  return await uploadImage('organization_logo', orgId, orgId, actor.id, file, io);
}

/**
 * Removes an Organization's logo: none of its Images is shown again, to anyone.
 * Admin of the Organization, or Superadmin.
 * @throws NOT_FOUND for an unknown Organization.
 * @throws FORBIDDEN when the actor may not manage the Organization.
 */
export async function removeOrganizationLogoHandler(request: Request, orgId: string, io: AppIO): Promise<void> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  if (!await io.orgRepo.getById(orgId)) throw new Error('NOT_FOUND');
  await io.imageRepo.detachAll('organization_logo', orgId, new Date());
}

/** How many Images a User may upload within any 24 hours. */
export const DAILY_IMAGE_LIMIT = 10;

const REFUSAL_ERRORS: Record<ImageRefusal, string> = {
  too_large: 'IMAGE_TOO_LARGE',
  unreadable: 'IMAGE_UNREADABLE',
  unsupported_format: 'IMAGE_UNSUPPORTED_FORMAT',
  wrong_proportion: 'IMAGE_WRONG_PROPORTION',
  too_small: 'IMAGE_TOO_SMALL'
};

/**
 * Prepares, screens and stores an uploaded file as the owner's latest Image.
 *
 * Screening decides the Image's state through the Screening Policy. When Screening cannot
 * conclude (an engine failed, or no Screening Policy is set yet), the Image waits In Review
 * marked as not screened.
 * @throws IMAGE_DAILY_LIMIT when the uploader already uploaded DAILY_IMAGE_LIMIT Images in the last 24 hours.
 * @throws IMAGE_TOO_LARGE, IMAGE_UNREADABLE, IMAGE_UNSUPPORTED_FORMAT, IMAGE_WRONG_PROPORTION or
 * IMAGE_TOO_SMALL when the file cannot become an Image of `kind` (see `prepareImage`).
 * @throws IMAGE_STORAGE_FAILED when the ImageStore refused the bytes; nothing is recorded then.
 */
async function uploadImage(kind: ImageKind, ownerId: string, organizationId: string, uploaderId: string, file: Blob, io: AppIO): Promise<ImageView> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (await io.imageRepo.countByUploaderSince(uploaderId, dayAgo) >= DAILY_IMAGE_LIMIT) throw new Error('IMAGE_DAILY_LIMIT');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(REFUSAL_ERRORS.too_large);

  const prepared = await prepareImage(new Uint8Array(await file.arrayBuffer()), kind);
  if (!prepared.ok) throw new Error(REFUSAL_ERRORS[prepared.error]);

  const screening = await io.imageScreener.screen(prepared.value.webp);
  const policy = await io.screeningPolicyRepo.get();
  const scores = screening.ok ? screening.value : {};
  const concluded = screening.ok && policy !== null;
  const state = concluded ? verdictFor(scores, policy) : 'in_review';

  const id = randomUUID();
  const stored = await io.imageStore.storeRestricted(id, prepared.value.webp);
  if (!stored.ok) throw new Error('IMAGE_STORAGE_FAILED');

  const image: Image = {
    id, kind, ownerId, organizationId, uploaderId,
    uploadedAt: new Date().toISOString(),
    thumbhash: prepared.value.thumbhash,
    width: prepared.value.width,
    height: prepared.value.height,
    state,
    notScreened: !concluded,
    scores
  };
  await io.imageRepo.create(image);
  return { url: io.imageStore.signedUrl(id), thumbhash: image.thumbhash };
}

/**
 * The owner's Image as one viewer sees it. Its uploader always sees their latest Image, by a
 * signed URL whatever its state. Everyone else sees the latest Approved Image, or only the
 * Placeholder of the latest Image while none is Approved.
 * @returns undefined when the owner has no Image.
 */
export async function imageViewFor(kind: ImageKind, ownerId: string, viewerId: string | null, io: AppIO): Promise<ImageView | undefined> {
  const { latest, approved } = await io.imageRepo.currentFor(kind, ownerId);
  if (!latest) return undefined;
  if (viewerId !== null && latest.uploaderId === viewerId) {
    return { url: io.imageStore.signedUrl(latest.id), thumbhash: latest.thumbhash };
  }
  if (approved) return { url: io.imageStore.publicUrl(approved.id), thumbhash: approved.thumbhash };
  return { thumbhash: latest.thumbhash };
}

/**
 * The Organization's Images awaiting Image Review that the actor may decide, oldest first.
 * Moderators and Admins of the Organization, or Superadmins.
 * @throws FORBIDDEN when the actor may not moderate the Organization.
 */
export async function listImageReviewsHandler(request: Request, orgId: string, io: AppIO): Promise<ImageReviewItem[]> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Moderator');

  const items: ImageReviewItem[] = [];
  for (const image of await io.imageRepo.listInReview()) {
    if (image.organizationId !== orgId) continue;
    const uploader = await io.userRepo.getById(image.uploaderId);
    if (!uploader || !mayReview(actor, image, uploader)) continue;
    items.push(await reviewItemOf(image, uploader, io));
  }
  return items;
}

/**
 * The Images awaiting Image Review that only Superadmins can decide, oldest first: those
 * uploaded by a Superadmin, and those whose Organization has no Moderator or Admin other
 * than their uploader. Superadmin only; the actor's own Images are left out.
 * @throws FORBIDDEN when the actor is not a Superadmin.
 */
export async function listEscalatedImageReviewsHandler(request: Request, io: AppIO): Promise<ImageReviewItem[]> {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin') throw new Error('FORBIDDEN');

  const items: ImageReviewItem[] = [];
  for (const image of await io.imageRepo.listInReview()) {
    const uploader = await io.userRepo.getById(image.uploaderId);
    if (!uploader || !mayReview(actor, image, uploader)) continue;
    if (uploader.role !== 'Superadmin' && await hasOrganizationReviewer(image, io)) continue;
    items.push(await reviewItemOf(image, uploader, io));
  }
  return items;
}

/** Whether a Moderator or Admin of the Image's Organization, other than its uploader, can review it. */
async function hasOrganizationReviewer(image: Image, io: AppIO): Promise<boolean> {
  const users = await io.userRepo.listByOrganization(image.organizationId);
  return users.some(u => u.id !== image.uploaderId && hasAtLeastRole(u.role, 'Moderator'));
}

/**
 * Whether `actor` may decide `image` in Image Review: never its own uploader; any other
 * Superadmin; otherwise a Moderator+ of the Image's Organization, unless a Superadmin
 * uploaded it (Superadmins' Images are reviewed by other Superadmins).
 */
function mayReview(actor: User, image: Image, uploader: User): boolean {
  if (actor.id === image.uploaderId) return false;
  if (actor.role === 'Superadmin') return true;
  return organizationOf(actor) === image.organizationId
    && hasAtLeastRole(actor.role, 'Moderator')
    && uploader.role !== 'Superadmin';
}

/** What a reviewer needs to judge an Image in context. */
async function reviewItemOf(image: Image, uploader: User, io: AppIO): Promise<ImageReviewItem> {
  return {
    id: image.id,
    kind: image.kind,
    ownerId: image.ownerId,
    ownerName: await ownerNameOf(image, io),
    organizationId: image.organizationId,
    uploaderId: uploader.id,
    uploaderName: `${uploader.firstName} ${uploader.lastName}`,
    uploadedAt: image.uploadedAt,
    notScreened: image.notScreened,
    scores: image.scores,
    previewUrl: io.imageStore.signedUrl(image.id),
    thumbhash: image.thumbhash
  };
}

/**
 * The Event's title or the Organization's name the Image belongs to.
 * @throws IMAGE_OWNER_MISSING when the owner is gone, which Events (soft-deleted) and
 * Organizations (never deleted) cannot be.
 */
async function ownerNameOf(image: Image, io: AppIO): Promise<string> {
  const name = image.kind === 'event_banner'
    ? (await io.eventRepo.getById(image.ownerId))?.title
    : (await io.orgRepo.getById(image.ownerId))?.name;
  if (name === undefined) throw new Error(`IMAGE_OWNER_MISSING: ${image.kind} ${image.ownerId}`);
  return name;
}

/**
 * Approves an Image in Image Review: it replaces the Placeholder (or the previous Approved
 * Image) for everyone. Recorded in the Audit Trail.
 * @throws NOT_FOUND for an unknown Image.
 * @throws FORBIDDEN when the actor may not review it (see `mayReview`).
 * @throws IMAGE_ALREADY_DECIDED when the Image is not In Review (any more).
 */
export async function approveImageHandler(request: Request, imageId: string, io: AppIO): Promise<{ state: 'approved' }> {
  const { actor, image } = await reviewableImage(request, imageId, io);
  const decided = await io.imageRepo.decide(image.id, 'approved', actor.id, new Date());
  if (!decided) throw new Error('IMAGE_ALREADY_DECIDED');
  await logAudit(io, actor.id, image.organizationId, 'approve_image', 'image', image.id);
  return { state: 'approved' };
}

/**
 * Rejects an Image in Image Review. This is a Confirmed Rejection: the Image is never shown
 * and its uploader is shadow-banned. Both are recorded in the Audit Trail.
 * @throws NOT_FOUND for an unknown Image.
 * @throws FORBIDDEN when the actor may not review it (see `mayReview`).
 * @throws IMAGE_ALREADY_DECIDED when the Image is not In Review (any more).
 */
export async function rejectImageHandler(request: Request, imageId: string, io: AppIO): Promise<{ state: 'rejected' }> {
  const { actor, image, uploader } = await reviewableImage(request, imageId, io);
  const decided = await io.imageRepo.decide(image.id, 'rejected', actor.id, new Date());
  if (!decided) throw new Error('IMAGE_ALREADY_DECIDED');
  await logAudit(io, actor.id, image.organizationId, 'reject_image', 'image', image.id);

  if (!uploader.isShadowBanned) {
    await io.userRepo.update(uploader.id, { isShadowBanned: true });
    await logAudit(io, actor.id, image.organizationId, 'apply_shadow_ban', 'user', uploader.id, { reason: 'confirmed_image_rejection', imageId: image.id });
  }
  return { state: 'rejected' };
}

/** The Image the actor wants to decide, after checking they may review it. */
async function reviewableImage(request: Request, imageId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  const image = await io.imageRepo.getById(imageId);
  if (!image) throw new Error('NOT_FOUND');
  const uploader = await io.userRepo.getById(image.uploaderId);
  if (!uploader) throw new Error('NOT_FOUND');
  if (!mayReview(actor, image, uploader)) throw new Error('FORBIDDEN');
  return { actor, image, uploader };
}
