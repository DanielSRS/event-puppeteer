import type { Organization } from '../types/organization.ts';
import type { User, NewUser, UserUpdate } from '../types/user.ts';
import type { Tag, LinkLabel } from '../types/tag.ts';
import type { Event } from '../types/event.ts';
import type { Vote } from '../types/vote.ts';
import type { Heartbeat, DeviceLog, DeviceTelemetry } from '../types/telemetry.ts';
import type { Command } from '../types/command.ts';
import type { Device } from '../types/device.ts';
import type { Report, AuditEntry } from '../types/moderation.ts';
import type { Image, ImageKind, ImageState, ScreeningPolicy, ScreeningScores } from '../types/image.ts';
import type { Result } from '../utils/result.ts';

export interface OrganizationRepository {
  create(org: Omit<Organization, 'id'>): Promise<Organization>;
  getById(id: string): Promise<Organization | null>;
  /** The Organization using `slug` (slugs are unique), or null. */
  findBySlug(slug: string): Promise<Organization | null>;
  getAll(): Promise<Organization[]>;
  update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null>;
}

/**
 * Users. A removed User keeps their row (the audit trail and past Events, Votes and
 * Reports reference it) but is treated as absent by every lookup except `getByEmail`.
 */
export interface UserRepository {
  create(user: User): Promise<User>;
  /** @returns null for an unknown or removed User. */
  getById(id: string): Promise<User | null>;
  /** Includes removed Users: their email stays taken. */
  getByEmail(email: string): Promise<User | null>;
  /** Removed Users are left out. */
  listByOrganization(orgId: string): Promise<User[]>;
  update(id: string, updates: UserUpdate): Promise<User | null>;
  /** Removed Users are left out. */
  searchByName(orgId: string, query: string): Promise<User[]>;
  /**
   * Marks a User as removed from their Organization (deactivation, not deletion).
   * @returns false when there is no such User or they were already removed.
   */
  markRemoved(id: string, removedAt: Date): Promise<boolean>;
}

export interface TagRepository {
  create(tag: Tag): Promise<Tag>;
  getAll(): Promise<Tag[]>;
  getById(id: string): Promise<Tag | null>;
  /**
   * Finds the Tag whose name matches, ignoring case and surrounding whitespace.
   * @returns null when no Tag has that name.
   */
  findByName(name: string): Promise<Tag | null>;
  update(id: string, updates: Partial<Tag>): Promise<Tag | null>;
}

export interface LinkLabelRepository {
  create(label: LinkLabel): Promise<LinkLabel>;
  getAll(): Promise<LinkLabel[]>;
  getById(id: string): Promise<LinkLabel | null>;
  /**
   * Finds the Link Label whose name matches, ignoring case and surrounding whitespace.
   * @returns null when no Link Label has that name.
   */
  findByName(name: string): Promise<LinkLabel | null>;
}

export interface EventRepository {
  create(event: Event): Promise<Event>;
  getById(id: string): Promise<Event | null>;
  listByOrganization(orgId: string): Promise<Event[]>;
  /**
   * Lists every Event a User created in an Organization, whatever its state
   * (hidden, expired, deleted, free-form tags included). Newest first.
   */
  listByCreator(orgId: string, creatorId: string): Promise<Event[]>;
  softDelete(id: string): Promise<Event | null>;
  /**
   * Soft-deletes every not yet deleted Event created by a User, in any Organization.
   * @returns how many Events were deleted.
   */
  softDeleteByCreator(creatorId: string): Promise<number>;
  update(id: string, updates: Partial<Event>): Promise<Event | null>;
}

export interface VoteRepository {
  create(vote: Vote): Promise<Vote>;
  delete(userId: string, eventId: string): Promise<boolean>;
  countByEvent(eventId: string): Promise<number>;
  existsByUserAndEvent(userId: string, eventId: string): Promise<boolean>;
  listByEvent(eventId: string): Promise<Vote[]>;
}

export interface ReportRepository {
  create(report: Report): Promise<Report>;
  listByEvent(eventId: string): Promise<Report[]>;
  listByOrganization(orgId: string): Promise<Report[]>;
  countUniqueReportersByEvent(eventId: string): Promise<number>;
  existsByUserAndEvent(userId: string, eventId: string): Promise<boolean>;
}

export interface AuditRepository {
  create(entry: AuditEntry): Promise<AuditEntry>;
  listByOrganization(orgId: string): Promise<AuditEntry[]>;
  listByActor(actorId: string): Promise<AuditEntry[]>;
  listByTarget(targetId: string): Promise<AuditEntry[]>;
}


export interface DeviceRepository {
  create(device: Omit<Device, 'id'>): Promise<Device>;
  getById(id: string): Promise<Device | null>;
  getByTokenHash(hash: string): Promise<Device | null>;
  listByOrganization(orgId: string): Promise<Device[]>;
  listPending(): Promise<Device[]>; // For a specific org or without org? Spec: listByOrganization, listPending, listPendingWithoutOrg
  listPendingWithoutOrg(): Promise<Device[]>;
  listPendingByOrg(orgId: string): Promise<Device[]>;
  findPendingByIdentifier(identifier: string): Promise<Device | null>;
  update(id: string, updates: Partial<Device>): Promise<Device | null>;
}


export interface TelemetryRepository {
  recordHeartbeat(heartbeat: Heartbeat): Promise<void>;
  recordLog(log: DeviceLog): Promise<void>;
  getLatestHeartbeat(deviceId: string): Promise<Heartbeat | null>;
  getHeartbeatHistory(deviceId: string): Promise<Heartbeat[]>;
  getDeviceLogs(deviceId: string): Promise<DeviceLog[]>;
  saveDetailedTelemetry(deviceId: string, telemetry: DeviceTelemetry): Promise<void>;
  getLatestTelemetry(deviceId: string): Promise<DeviceTelemetry | null>;
}

export interface CommandRepository {
  create(command: Command): Promise<Command>;
  getById(id: string): Promise<Command | null>;
  listByDevice(deviceId: string): Promise<Command[]>;
  updateStatus(id: string, status: Command['status']): Promise<Command | null>;
  /** Whether the Device has at least one Command in `pending` or `sent`, i.e. not yet acknowledged. */
  hasWaiting(deviceId: string): Promise<boolean>;
}

export interface AuthSession {
  token: string;
  userId: string;
}

export interface AuthProvider {
  // Creates the auth account and the User row in one insert, so the row is never
  // left without its role and Organization (the database rejects that).
  // No session: the email must be verified before signing in.
  signUp(password: string, user: NewUser): Promise<{ userId: string }>;
  // Throws INVALID_CREDENTIALS, or EMAIL_NOT_VERIFIED for an unverified account
  signIn(email: string, password: string): Promise<AuthSession>;
  getSessionUserId(request: Request): Promise<string | null>;
  // No-op for unknown or already verified emails (does not reveal which)
  sendVerificationEmail(email: string): Promise<void>;
  // false when the token is invalid or expired
  verifyEmail(token: string): Promise<boolean>;
  markEmailVerified(email: string): Promise<void>;
  /**
   * Ends every session of a User and deletes their credential accounts, so existing
   * tokens stop working and they can no longer log in. The User row is kept.
   */
  revokeAccess(userId: string): Promise<void>;
  /** Emails a link to choose a new password. No-op for unknown emails (does not reveal which). */
  sendPasswordResetEmail(email: string): Promise<void>;
  /** The User a still-valid password-reset token belongs to, or null for an unknown or expired token. */
  userIdForResetToken(token: string): Promise<string | null>;
  /** Sets a new password with a reset token and ends every session; false when the token is invalid or expired. */
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}

export interface EmailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Images and their Screening and Image Review outcomes. */
export interface ImageRepository {
  create(image: Image): Promise<Image>;
  getById(id: string): Promise<Image | null>;
  /** How many Images a User uploaded at or after `since`, whatever became of them. */
  countByUploaderSince(uploaderId: string, since: Date): Promise<number>;
  /**
   * The owner's latest Image and latest Approved Image, ignoring detached ones. They are the
   * same Image when the latest one is Approved; either is null when there is none.
   */
  currentFor(kind: ImageKind, ownerId: string): Promise<{ latest: Image | null; approved: Image | null }>;
  /** Detaches every Image of an owner, so none of them is shown again. */
  detachAll(kind: ImageKind, ownerId: string, at: Date): Promise<void>;
  /**
   * Detaches the owner's Images still In Review, except `keepId`: a newer upload supersedes
   * them, so they leave Image Review and can never be shown.
   */
  supersedePending(kind: ImageKind, ownerId: string, keepId: string, at: Date): Promise<void>;
  /** Images In Review that are still attached to their owner, oldest first. */
  listInReview(): Promise<Image[]>;
  /**
   * Decides an attached Image that is In Review, atomically: when two reviewers decide at
   * once, or its owner supersedes or removes it meanwhile, only one thing wins.
   * @returns the decided Image, or null when it is not In Review or not attached (any more).
   */
  decide(id: string, state: Exclude<ImageState, 'in_review'>, reviewerId: string, at: Date): Promise<Image | null>;
}

/** The Screening Policy, stored once for the whole system. */
export interface ScreeningPolicyRepository {
  /** @returns null until a Superadmin sets the policy for the first time. */
  get(): Promise<ScreeningPolicy | null>;
  set(policy: ScreeningPolicy): Promise<void>;
}

/**
 * Why Screening could not conclude, in words a reviewer can read, with whatever scores the
 * engines that did answer gave (empty when none did).
 */
export interface ScreeningFailure {
  reason: string;
  partialScores: ScreeningScores;
}

/** Analyses an Image for inappropriate content. */
export interface ImageScreener {
  /** Scores a normalized WebP Image. A failure means Screening could not conclude. */
  screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>>;
}

/** Why storing an Image failed. */
export type ImageStoreFailure = string;

/**
 * Where Image bytes live. Every asset is stored restricted: nobody can fetch it without a
 * URL that Puppeteer signs. Puppeteer hands out the public URL only for Approved Images.
 */
export interface ImageStore {
  /** Stores normalized WebP bytes as a restricted asset named `id`. */
  storeRestricted(id: string, webp: Uint8Array<ArrayBuffer>): Promise<Result<void, ImageStoreFailure>>;
  /** A permanent, cacheable URL of the asset. Only ever given out for an Approved Image. */
  publicUrl(id: string): string;
  /**
   * A URL that expires after a short while, for a viewer allowed to see the asset whatever
   * its state (its uploader, or a reviewer). Its shape never depends on the Image's state.
   */
  signedUrl(id: string): string;
}

/** Why issuing an upload grant for an update binary failed. */
export type UpdateBinaryStoreFailure = string;

/** What a browser needs to upload one update binary straight to the store. */
export interface UpdateUploadGrant {
  /** Where the binary will live in the store; the upload must use exactly this name. */
  pathname: string;
  /** Credential the browser presents to the store; it only allows this one upload. */
  clientToken: string;
}

/**
 * Where Puppet update binaries live until Devices download them. The browser uploads
 * straight to the store (a Function cannot take a body of tens of MiB), so Puppeteer only
 * decides what may be uploaded and issues the credential for it.
 */
export interface UpdateBinaryStore {
  /**
   * Authorizes one upload of at most `maxBytes` to `pathname`, as a private file: nobody
   * can read it without a URL from `signedDownloadUrl`.
   */
  issueUploadGrant(pathname: string, maxBytes: number): Promise<Result<UpdateUploadGrant, UpdateBinaryStoreFailure>>;
  /** A URL that downloads `pathname` with a plain GET until `validUntil` (ms since the epoch), and not afterwards. */
  signedDownloadUrl(pathname: string, validUntil: number): Promise<Result<string, UpdateBinaryStoreFailure>>;
}

export interface AppIO {
  orgRepo: OrganizationRepository;
  userRepo: UserRepository;
  tagRepo: TagRepository;
  linkLabelRepo: LinkLabelRepository;
  eventRepo: EventRepository;
  voteRepo: VoteRepository;
  reportRepo: ReportRepository;
  auditRepo: AuditRepository;
  deviceRepo: DeviceRepository;
  telemetryRepo: TelemetryRepository;
  commandRepo: CommandRepository;
  imageRepo: ImageRepository;
  screeningPolicyRepo: ScreeningPolicyRepository;
  auth: AuthProvider;
  emailSender: EmailSender;
  imageScreener: ImageScreener;
  imageStore: ImageStore;
  updateBinaryStore: UpdateBinaryStore;
}

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema.ts';
import { env } from '../env.ts';

import { DrizzleOrganizationRepository } from './drizzle/organization-repository.ts';
import { DrizzleUserRepository } from './drizzle/user-repository.ts';
import { DrizzleTagRepository } from './drizzle/tag-repository.ts';
import { DrizzleLinkLabelRepository } from './drizzle/link-label-repository.ts';
import { DrizzleEventRepository } from './drizzle/event-repository.ts';
import { DrizzleVoteRepository } from './drizzle/vote-repository.ts';
import { DrizzleReportRepository } from './drizzle/report-repository.ts';
import { DrizzleAuditRepository } from './drizzle/audit-repository.ts';
import { DrizzleDeviceRepository } from './drizzle/device-repository.ts';
import { DrizzleTelemetryRepository } from './drizzle/telemetry-repository.ts';
import { DrizzleCommandRepository } from './drizzle/command-repository.ts';
import { BetterAuthProvider } from './better-auth-adapter.ts';
import { createAuth } from '../auth.ts';
import { BrevoEmailSender } from './email/brevo.ts';
import { ConsoleEmailSender } from './email/console.ts';
import { DrizzleImageRepository } from './drizzle/image-repository.ts';
import { DrizzleScreeningPolicyRepository } from './drizzle/screening-policy-repository.ts';
import { CombinedImageScreener } from './screening/combined.ts';
import { SightengineImageScreener } from './screening/sightengine.ts';
import { OpenAIImageScreener } from './screening/openai.ts';
import { CloudinaryImageStore } from './image-store/cloudinary.ts';
import { VercelBlobUpdateBinaryStore } from './update-binary-store/vercel-blob.ts';

// close() ends the database pool: an open pool keeps the process alive after the server stops
export function createRealIO(): AppIO & { close(): Promise<void> } {
  // prepare: false — Supabase's transaction pooler (what serverless should use) rejects prepared statements
  const queryClient = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzle(queryClient, { schema });

  let emailSender: EmailSender = new ConsoleEmailSender();
  if (env.BREVO_API_KEY) {
    const brevo = new BrevoEmailSender(env.BREVO_API_KEY, { email: env.EMAIL_FROM!, name: env.EMAIL_FROM_NAME });
    // In the background: an invalid sender would otherwise only show up in Brevo's logs
    brevo.checkSender()
      .then(warning => { if (warning) console.warn(`⚠️  ${warning}`); })
      .catch(error => console.warn(`⚠️  Não foi possível verificar o remetente no Brevo: ${error.message}`));
    emailSender = brevo;
  }

  const authInstance = createAuth({
    db,
    emailSender,
    apiUrl: env.BETTER_AUTH_URL,
    appUrl: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    useSecureCookies: env.NODE_ENV === "production"
  });

  return {
    orgRepo: new DrizzleOrganizationRepository(db),
    userRepo: new DrizzleUserRepository(db),
    tagRepo: new DrizzleTagRepository(db),
    linkLabelRepo: new DrizzleLinkLabelRepository(db),
    eventRepo: new DrizzleEventRepository(db),
    voteRepo: new DrizzleVoteRepository(db),
    reportRepo: new DrizzleReportRepository(db),
    auditRepo: new DrizzleAuditRepository(db),
    deviceRepo: new DrizzleDeviceRepository(db),
    telemetryRepo: new DrizzleTelemetryRepository(db),
    commandRepo: new DrizzleCommandRepository(db),
    imageRepo: new DrizzleImageRepository(db),
    screeningPolicyRepo: new DrizzleScreeningPolicyRepository(db),
    auth: new BetterAuthProvider(authInstance),
    emailSender,
    imageScreener: new CombinedImageScreener([
      new SightengineImageScreener(env.SIGHTENGINE_API_USER, env.SIGHTENGINE_API_SECRET),
      new OpenAIImageScreener(env.OPENAI_API_KEY)
    ]),
    imageStore: new CloudinaryImageStore({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET
    }),
    updateBinaryStore: new VercelBlobUpdateBinaryStore(env.BLOB_READ_WRITE_TOKEN),
    close: () => queryClient.end({ timeout: 5 })
  };
}
