import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { registerVerified, pictureFile } from '../test-support.ts';
import { createInMemoryIO, type InMemoryIO } from '../io/in-memory.ts';
import { seedSuperadminHandler } from './seed.ts';
import { loginHandler } from './auth.ts';
import { createEventHandler, getEventHandler, deleteEventHandler, listEventsHandler, listMyEventsHandler } from './events.ts';
import { setScreeningPolicyHandler, uploadEventBannerHandler, listImageReviewsHandler, listEscalatedImageReviewsHandler, approveImageHandler, rejectImageHandler, removeEventBannerHandler, uploadOrganizationLogoHandler, removeOrganizationLogoHandler, getScreeningPolicyHandler } from './images.ts';
import { eventFeedHandler } from './feed.ts';
import { getOrganizationHandler } from './organization.ts';
import { liftShadowBanHandler, listAuditTrailHandler } from './moderation.ts';
import type { ScreeningPolicy } from '../types/image.ts';
import { thumbHashToApproximateAspectRatio } from 'thumbhash';

const asToken = (token: string) => new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
const anonymous = new Request('http://localhost/');

/** Every category: Approved below 0.3, Rejected from 0.8, In Review in between. */
const POLICY: ScreeningPolicy = {
  nudity: { lower: 0.3, upper: 0.8 },
  gore: { lower: 0.3, upper: 0.8 },
  violence: { lower: 0.3, upper: 0.8 },
  weapons: { lower: 0.3, upper: 0.8 },
  hate: { lower: 0.3, upper: 0.8 },
  offensive_gesture: { lower: 0.3, upper: 0.8 },
  offensive_text: { lower: 0.3, upper: 0.8 }
};

async function setup({ withPolicy = true } = {}) {
  const io = await createInMemoryIO();
  await seedSuperadminHandler({ email: 'root@a.com', password: 'secret-123', firstName: 'Root', lastName: 'A' }, io);
  const superadmin = asToken((await loginHandler({ email: 'root@a.com', password: 'secret-123' }, io)).token);
  const org = await io.orgRepo.create({ name: 'Org', slug: 'org', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

  const member = async (email: string, role: 'Member' | 'Moderator' | 'Admin' = 'Member') => {
    const { token, user } = await registerVerified({ firstName: email, lastName: 'X', email, password: 'password123' }, org.id, io);
    if (role !== 'Member') await io.userRepo.update(user.id, { role });
    return { req: asToken(token), user };
  };

  if (withPolicy) await setScreeningPolicyHandler(superadmin, POLICY, io);
  return { io, org, superadmin, member };
}

async function eventBy(io: InMemoryIO, orgId: string, req: Request) {
  return await createEventHandler(req, orgId, {
    title: 'Palestra', description: '...', location: 'Auditório', isHidden: false,
    schedule: [{ date: '2100-01-01' }], tags: [], links: []
  }, io);
}

test('Image Screening', async (t) => {
  await t.test('a banner that Screening approves is shown to everyone, stored as WebP', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);

    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    const seen = await getEventHandler(anonymous, org.id, event.id, io);
    assert.ok(seen.banner, 'the visitor sees a banner');
    assert.match(seen.banner.url ?? '', /^memory:\/\/public\//);
    assert.ok(seen.banner.thumbhash.length > 0);

    const [stored] = [...io.imageStore.assets.values()];
    assert.ok(stored);
    assert.equal((await sharp(stored).metadata()).format, 'webp');
  });

  await t.test('a banner In Review shows only its Placeholder to others, while its uploader sees it as published', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const other = await member('other@a.com');
    const event = await eventBy(io, org.id, creator.req);
    io.imageScreener.scores = { ...io.imageScreener.scores, violence: 0.5 };

    const uploaded = await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    const byOther = await getEventHandler(other.req, org.id, event.id, io);
    assert.deepEqual(byOther.banner, { thumbhash: uploaded.thumbhash });
    const byCreator = await getEventHandler(creator.req, org.id, event.id, io);
    assert.match(byCreator.banner?.url ?? '', /^memory:\/\/signed\//);
  });

  await t.test('a banner Rejected by Screening alone stays hidden from others and does not shadow-ban its uploader', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    io.imageScreener.scores = { ...io.imageScreener.scores, hate: 0.95 };

    const uploaded = await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    assert.deepEqual((await getEventHandler(anonymous, org.id, event.id, io)).banner, { thumbhash: uploaded.thumbhash });
    assert.match((await getEventHandler(creator.req, org.id, event.id, io)).banner?.url ?? '', /^memory:\/\/signed\//);
    assert.equal((await io.userRepo.getById(creator.user.id))?.isShadowBanned, false);
  });

  await t.test('an Image whose Screening fails waits in Image Review, marked as not screened, and is never shown', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const event = await eventBy(io, org.id, creator.req);
    io.imageScreener.failure = 'Sightengine answered 503';

    const uploaded = await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    assert.deepEqual((await getEventHandler(anonymous, org.id, event.id, io)).banner, { thumbhash: uploaded.thumbhash });
    const queue = await listImageReviewsHandler(moderator.req, org.id, io);
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.notScreened, true);
    assert.equal(queue[0]?.kind, 'event_banner');
    assert.equal(queue[0]?.ownerName, 'Palestra');
    assert.equal(queue[0]?.uploaderName, 'creator@a.com X');
    assert.match(queue[0]?.previewUrl ?? '', /^memory:\/\/signed\//);
  });

  await t.test('the Image Review queue shows the suspected scores and leaves out Approved and Rejected Images', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const event = await eventBy(io, org.id, creator.req);

    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);
    io.imageScreener.scores = { ...io.imageScreener.scores, hate: 0.95 };
    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);
    io.imageScreener.scores = { ...io.imageScreener.scores, hate: 0, weapons: 0.4 };
    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    const queue = await listImageReviewsHandler(moderator.req, org.id, io);
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.notScreened, false);
    assert.equal(queue[0]?.scores.weapons, 0.4);
  });

  await t.test('without a Screening Policy every Image waits in Image Review', async () => {
    const { io, org, member } = await setup({ withPolicy: false });
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const event = await eventBy(io, org.id, creator.req);

    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    assert.equal((await listImageReviewsHandler(moderator.req, org.id, io)).length, 1);
  });

  await t.test('only Moderators and Admins of the Organization, or Superadmins, see its Image Review queue', async () => {
    const { io, org, member, superadmin } = await setup();
    const plain = await member('plain@a.com');
    const admin = await member('admin@a.com', 'Admin');

    await assert.rejects(listImageReviewsHandler(plain.req, org.id, io), /FORBIDDEN/);
    assert.deepEqual(await listImageReviewsHandler(admin.req, org.id, io), []);
    assert.deepEqual(await listImageReviewsHandler(superadmin, org.id, io), []);
  });

  /** An Event by `creator` whose banner waits in Image Review. */
  async function bannerInReview(io: InMemoryIO, orgId: string, creator: { req: Request }) {
    const event = await eventBy(io, orgId, creator.req);
    io.imageScreener.scores = { ...io.imageScreener.scores, violence: 0.5 };
    await uploadEventBannerHandler(creator.req, orgId, event.id, await pictureFile(1920, 1080), io);
    io.imageScreener.scores = { ...io.imageScreener.scores, violence: 0 };
    const [item] = [...(await io.imageRepo.listInReview())];
    assert.ok(item);
    return { event, imageId: item.id };
  }

  await t.test('approving an Image in Image Review shows it to everyone and records who decided', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const admin = await member('admin@a.com', 'Admin');
    const { event, imageId } = await bannerInReview(io, org.id, creator);

    await approveImageHandler(moderator.req, imageId, io);

    assert.equal((await getEventHandler(anonymous, org.id, event.id, io)).banner?.url, `memory://public/${imageId}.webp`);
    assert.deepEqual(await listImageReviewsHandler(admin.req, org.id, io), []);
    const audit = await listAuditTrailHandler(admin.req, org.id, io);
    assert.ok(audit.some(e => e.action === 'approve_image' && e.targetId === imageId && e.actorId === moderator.user.id));
  });

  await t.test('rejecting an Image in Image Review is a Confirmed Rejection: it shadow-bans the uploader', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const admin = await member('admin@a.com', 'Admin');
    const { event, imageId } = await bannerInReview(io, org.id, creator);

    await rejectImageHandler(moderator.req, imageId, io);

    assert.equal((await io.userRepo.getById(creator.user.id))?.isShadowBanned, true);
    assert.equal((await getEventHandler(creator.req, org.id, event.id, io)).banner?.url, `memory://signed/${imageId}.webp`);
    const audit = await listAuditTrailHandler(admin.req, org.id, io);
    assert.ok(audit.some(e => e.action === 'reject_image' && e.targetId === imageId && e.actorId === moderator.user.id));
    assert.ok(audit.some(e => e.action === 'apply_shadow_ban' && e.targetId === creator.user.id && e.details?.reason === 'confirmed_image_rejection'));
  });

  await t.test('lifting the Shadow Ban of a Confirmed Rejection leaves the Image rejected', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const { event, imageId } = await bannerInReview(io, org.id, creator);
    await rejectImageHandler(moderator.req, imageId, io);

    await liftShadowBanHandler(moderator.req, org.id, creator.user.id, io);

    const seen = await getEventHandler(anonymous, org.id, event.id, io);
    assert.equal(seen.banner?.url, undefined);
  });

  await t.test('an Image already decided cannot be decided again', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const moderator = await member('mod@a.com', 'Moderator');
    const admin = await member('admin@a.com', 'Admin');
    const { imageId } = await bannerInReview(io, org.id, creator);
    await approveImageHandler(moderator.req, imageId, io);

    await assert.rejects(rejectImageHandler(admin.req, imageId, io), /IMAGE_ALREADY_DECIDED/);
    assert.equal((await io.userRepo.getById(creator.user.id))?.isShadowBanned, false);
  });

  await t.test('nobody reviews their own Image, and Members review nothing', async () => {
    const { io, org, member } = await setup();
    const moderator = await member('mod@a.com', 'Moderator');
    const plain = await member('plain@a.com');
    const { imageId } = await bannerInReview(io, org.id, moderator);

    assert.deepEqual(await listImageReviewsHandler(moderator.req, org.id, io), []);
    await assert.rejects(approveImageHandler(moderator.req, imageId, io), /FORBIDDEN/);
    await assert.rejects(approveImageHandler(plain.req, imageId, io), /FORBIDDEN/);
  });

  await t.test('deciding an unknown Image answers NOT_FOUND', async () => {
    const { io, member } = await setup();
    const moderator = await member('mod@a.com', 'Moderator');
    await assert.rejects(approveImageHandler(moderator.req, 'no-such-image', io), /NOT_FOUND/);
  });

  await t.test('an Image whose Organization has no other reviewer goes to the Superadmins', async () => {
    const { io, org, member, superadmin } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    const { imageId } = await bannerInReview(io, org.id, admin);

    const escalated = await listEscalatedImageReviewsHandler(superadmin, io);
    assert.deepEqual(escalated.map(i => i.id), [imageId]);

    await member('mod@a.com', 'Moderator');
    assert.deepEqual(await listEscalatedImageReviewsHandler(superadmin, io), [], 'a new Moderator takes it back to the Organization');
  });

  await t.test("a Superadmin's Image is reviewed by another Superadmin, and stays pending while there is none", async () => {
    const { io, org, member, superadmin } = await setup();
    const moderator = await member('mod@a.com', 'Moderator');
    const { imageId } = await bannerInReview(io, org.id, { req: superadmin });

    assert.deepEqual(await listImageReviewsHandler(moderator.req, org.id, io), [], "Organization reviewers don't judge Superadmins");
    assert.deepEqual(await listEscalatedImageReviewsHandler(superadmin, io), []);
    await assert.rejects(approveImageHandler(moderator.req, imageId, io), /FORBIDDEN/);

    await seedSuperadminHandler({ email: 'root2@a.com', password: 'secret-123', firstName: 'Root', lastName: 'B' }, io);
    const other = asToken((await loginHandler({ email: 'root2@a.com', password: 'secret-123' }, io)).token);
    assert.deepEqual((await listEscalatedImageReviewsHandler(other, io)).map(i => i.id), [imageId]);
    await approveImageHandler(other, imageId, io);
  });

  await t.test('only Superadmins see the escalated Image Review queue', async () => {
    const { io, member } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    await assert.rejects(listEscalatedImageReviewsHandler(admin.req, io), /FORBIDDEN/);
  });

  /** Uploads `file` as the banner of a new Event and returns what the store received. */
  async function storedBanner(file: File) {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    const view = await uploadEventBannerHandler(creator.req, org.id, event.id, file, io);
    const [bytes] = [...io.imageStore.assets.values()];
    assert.ok(bytes);
    return { view, bytes, metadata: await sharp(bytes).metadata() };
  }

  await t.test('a banner larger than 1920×1080 is scaled down to exactly 1920×1080', async () => {
    const { metadata } = await storedBanner(await pictureFile(3840, 2160));
    assert.deepEqual([metadata.width, metadata.height], [1920, 1080]);
  });

  await t.test('a banner within the maximum keeps its size but is still re-encoded as WebP without metadata', async () => {
    const { metadata } = await storedBanner(await pictureFile(1280, 720, { format: 'jpeg', gps: true }));
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [1280, 720, 'webp']);
    assert.equal(metadata.exif, undefined, 'camera and GPS data are gone');
  });

  await t.test("a photo's EXIF orientation is applied before checking its proportion", async () => {
    const { metadata } = await storedBanner(await pictureFile(1080, 1920, { format: 'jpeg', orientation: 6 }));
    assert.deepEqual([metadata.width, metadata.height], [1920, 1080]);
  });

  await t.test("a banner's thumbhash decodes to the banner's proportion", async () => {
    const { view } = await storedBanner(await pictureFile(1920, 1080));
    const ratio = thumbHashToApproximateAspectRatio(Buffer.from(view.thumbhash, 'base64'));
    assert.ok(Math.abs(ratio - 16 / 9) < 0.1, `ratio ${ratio}`);
  });

  await t.test('a banner one pixel off 16:9 is accepted', async () => {
    const { metadata } = await storedBanner(await pictureFile(1280, 721));
    assert.equal(metadata.format, 'webp');
  });

  await t.test('uploads that cannot become a banner are refused with their reason, and nothing is stored', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    const upload = (file: File) => uploadEventBannerHandler(creator.req, org.id, event.id, file, io);

    await assert.rejects(upload(await pictureFile(1000, 1000)), /IMAGE_WRONG_PROPORTION/);
    await assert.rejects(upload(await pictureFile(800, 450)), /IMAGE_TOO_SMALL/);
    await assert.rejects(upload(new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })), /IMAGE_TOO_LARGE/);
    await assert.rejects(upload(new File([new TextEncoder().encode('not a picture')], 'a.png', { type: 'image/png' })), /IMAGE_UNREADABLE/);
    const gif = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#123456' } }).gif().toBuffer();
    await assert.rejects(upload(new File([gif], 'a.gif', { type: 'image/gif' })), /IMAGE_UNSUPPORTED_FORMAT/);

    assert.equal(io.imageStore.assets.size, 0);
    assert.equal((await getEventHandler(anonymous, org.id, event.id, io)).banner, undefined);
  });

  await t.test('a User may upload at most 10 Images a day', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    const file = await pictureFile(960, 540);
    for (let i = 0; i < 10; i++) await uploadEventBannerHandler(creator.req, org.id, event.id, file, io);

    await assert.rejects(uploadEventBannerHandler(creator.req, org.id, event.id, file, io), /IMAGE_DAILY_LIMIT/);
    assert.equal(io.imageStore.assets.size, 10);
  });

  await t.test('a pending replacement never blanks the previous Approved banner', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);
    const before = (await getEventHandler(anonymous, org.id, event.id, io)).banner;
    io.imageScreener.scores = { ...io.imageScreener.scores, gore: 0.5 };

    const replacement = await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1280, 720), io);

    assert.deepEqual((await getEventHandler(anonymous, org.id, event.id, io)).banner, before);
    assert.equal((await getEventHandler(creator.req, org.id, event.id, io)).banner?.url, replacement.url);
  });

  await t.test('removing the banner leaves the Event without one, for everyone', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const event = await eventBy(io, org.id, creator.req);
    await uploadEventBannerHandler(creator.req, org.id, event.id, await pictureFile(1920, 1080), io);

    await removeEventBannerHandler(creator.req, org.id, event.id, io);

    assert.equal((await getEventHandler(anonymous, org.id, event.id, io)).banner, undefined);
    assert.equal((await getEventHandler(creator.req, org.id, event.id, io)).banner, undefined);
  });

  await t.test("only an Event's creator changes its banner, and not once the Event is deleted", async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const admin = await member('admin@a.com', 'Admin');
    const event = await eventBy(io, org.id, creator.req);
    const file = await pictureFile(1920, 1080);

    await assert.rejects(uploadEventBannerHandler(admin.req, org.id, event.id, file, io), /FORBIDDEN/);
    await assert.rejects(removeEventBannerHandler(admin.req, org.id, event.id, io), /FORBIDDEN/);
    await assert.rejects(uploadEventBannerHandler(anonymous, org.id, event.id, file, io), /UNAUTHORIZED/);
    await deleteEventHandler(creator.req, org.id, event.id, io);
    await assert.rejects(uploadEventBannerHandler(creator.req, org.id, event.id, file, io), /NOT_FOUND/);
  });

  await t.test("an Admin's logo is screened like any Image and shown on the Organization", async () => {
    const { io, org, member } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    const plain = await member('plain@a.com');

    await assert.rejects(uploadOrganizationLogoHandler(plain.req, org.id, await pictureFile(512, 512), io), /FORBIDDEN/);
    await assert.rejects(uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(1920, 1080), io), /IMAGE_WRONG_PROPORTION/);
    await assert.rejects(uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(200, 200), io), /IMAGE_TOO_SMALL/);
    await uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(1024, 1024), io);

    const seen = await getOrganizationHandler(anonymous, org.id, io);
    assert.match(seen?.logo?.url ?? '', /^memory:\/\/public\//);
    const [bytes] = [...io.imageStore.assets.values()];
    assert.ok(bytes);
    const metadata = await sharp(bytes).metadata();
    assert.deepEqual([metadata.width, metadata.height], [512, 512]);
  });

  await t.test("a Confirmed Rejection of a logo shadow-bans the Admin who uploaded it, while the Organization keeps its last Approved logo", async () => {
    const { io, org, member } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    const moderator = await member('mod@a.com', 'Moderator');
    await uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(512, 512), io);
    const approvedLogo = (await getOrganizationHandler(anonymous, org.id, io))?.logo;
    io.imageScreener.scores = { ...io.imageScreener.scores, offensive_gesture: 0.6 };
    await uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(512, 512), io);
    const [pending] = await listImageReviewsHandler(moderator.req, org.id, io);
    assert.equal(pending?.kind, 'organization_logo');
    assert.equal(pending?.ownerName, 'Org');

    await rejectImageHandler(moderator.req, pending.id, io);

    assert.equal((await io.userRepo.getById(admin.user.id))?.isShadowBanned, true);
    assert.deepEqual((await getOrganizationHandler(anonymous, org.id, io))?.logo, approvedLogo);
  });

  await t.test('removing the logo leaves the Organization without one', async () => {
    const { io, org, member } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    await uploadOrganizationLogoHandler(admin.req, org.id, await pictureFile(512, 512), io);

    await removeOrganizationLogoHandler(admin.req, org.id, io);

    assert.equal((await getOrganizationHandler(anonymous, org.id, io))?.logo, undefined);
  });

  await t.test('the Screening Policy is unset until the Superadmin sets it, and every change is audited', async () => {
    const { io, superadmin } = await setup({ withPolicy: false });
    assert.equal(await getScreeningPolicyHandler(superadmin, io), null);

    await setScreeningPolicyHandler(superadmin, POLICY, io);

    assert.deepEqual(await getScreeningPolicyHandler(superadmin, io), POLICY);
    const root = await io.userRepo.getByEmail('root@a.com');
    const audit = await io.auditRepo.listByActor(root?.id ?? '');
    assert.ok(audit.some(e => e.action === 'update_screening_policy' && e.targetType === 'screening_policy'));
  });

  await t.test('an incoherent Screening Policy is refused', async () => {
    const { io, superadmin } = await setup();
    await assert.rejects(setScreeningPolicyHandler(superadmin, { ...POLICY, nudity: { lower: 0.9, upper: 0.2 } }, io), /SCREENING_POLICY_INVALID/);
    await assert.rejects(setScreeningPolicyHandler(superadmin, { ...POLICY, gore: { lower: -0.1, upper: 0.5 } }, io), /SCREENING_POLICY_INVALID/);
    await assert.rejects(setScreeningPolicyHandler(superadmin, { ...POLICY, hate: { lower: 0.2, upper: 1.5 } }, io), /SCREENING_POLICY_INVALID/);
    assert.deepEqual(await getScreeningPolicyHandler(superadmin, io), POLICY);
  });

  await t.test('only Superadmins read or change the Screening Policy', async () => {
    const { io, member } = await setup();
    const admin = await member('admin@a.com', 'Admin');
    await assert.rejects(getScreeningPolicyHandler(admin.req, io), /FORBIDDEN/);
    await assert.rejects(setScreeningPolicyHandler(admin.req, POLICY, io), /FORBIDDEN/);
  });

  await t.test('the kiosk feed and the Event lists carry each banner as their viewer may see it', async () => {
    const { io, org, member } = await setup();
    const creator = await member('creator@a.com');
    const approvedEvent = await eventBy(io, org.id, creator.req);
    await uploadEventBannerHandler(creator.req, org.id, approvedEvent.id, await pictureFile(1920, 1080), io);
    const pendingEvent = await eventBy(io, org.id, creator.req);
    io.imageScreener.scores = { ...io.imageScreener.scores, nudity: 0.5 };
    const pending = await uploadEventBannerHandler(creator.req, org.id, pendingEvent.id, await pictureFile(1920, 1080), io);

    const feed = await eventFeedHandler(org.id, io);
    assert.match(feed.find(e => e.id === approvedEvent.id)?.banner?.url ?? '', /^memory:\/\/public\//);
    assert.deepEqual(feed.find(e => e.id === pendingEvent.id)?.banner, { thumbhash: pending.thumbhash });

    const listed = await listEventsHandler(anonymous, org.id, io);
    assert.deepEqual(listed.find(e => e.id === pendingEvent.id)?.banner, { thumbhash: pending.thumbhash });
    const mine = await listMyEventsHandler(creator.req, org.id, io);
    assert.equal(mine.find(e => e.id === pendingEvent.id)?.banner?.url, pending.url);
  });
});
