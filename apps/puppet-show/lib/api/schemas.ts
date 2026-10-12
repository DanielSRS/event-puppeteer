/**
 * The Puppeteer API contract, as runtime schemas.
 *
 * Every response the client receives is parsed with one of these schemas, so a
 * payload that drifts from the contract becomes a visible error instead of an
 * `undefined` deep inside a component. The TypeScript types used by the app are
 * inferred from the schemas, so the two can never disagree.
 *
 * Mirrors `apps/puppeteer/src/types/*`. Keep them in sync.
 *
 * @module
 */

import { z } from "zod";

/** Role hierarchy: Superadmin > Admin > Moderator > Member. */
export const UserRoleSchema = z.enum(["Superadmin", "Admin", "Moderator", "Member"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Roles that live inside an organization (everything but Superadmin). */
export const OrgRoleSchema = z.enum(["Admin", "Moderator", "Member"]);
export type OrgRole = z.infer<typeof OrgRoleSchema>;

const userFields = {
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  normalizedName: z.string(),
  email: z.string(),
  isShadowBanned: z.boolean(),
};

/** A Superadmin lives above organizations and has no `organizationId`. */
export const SuperadminUserSchema = z.object({ ...userFields, role: z.literal("Superadmin") });

/** Everyone else belongs to exactly one organization. */
export const OrgUserSchema = z.object({ ...userFields, role: OrgRoleSchema, organizationId: z.string() });

export const UserSchema = z.union([SuperadminUserSchema, OrgUserSchema]);
export type User = z.infer<typeof UserSchema>;
export type OrgUser = z.infer<typeof OrgUserSchema>;

/** The organization a user belongs to, or `null` for a Superadmin. */
export function UserOrgId(user: User): string | null {
  return user.role === "Superadmin" ? null : user.organizationId;
}

/**
 * An Image (Event banner or Organization logo) as the viewer may see it. `thumbhash`
 * always comes and draws the Placeholder; `url` is absent while the viewer may only see
 * the Placeholder (an Image not yet Approved, uploaded by someone else).
 */
export const ImageViewSchema = z.object({ url: z.string().optional(), thumbhash: z.string() });
export type ImageView = z.infer<typeof ImageViewSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  /** Absent when the organization never had a logo. */
  logo: ImageViewSchema.optional(),
  url: z.string().optional(),
  colorScheme: z.string().optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  shadowBanThreshold: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

/** Body of `POST /organizations`; `PATCH` takes any subset of it. The logo is uploaded apart. */
export type OrganizationInput = {
  name: string;
  slug: string;
  description?: string;
  url?: string;
  colorScheme?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  shadowBanThreshold?: number;
};

/**
 * One day of an event's schedule. No times = all day; start only = all day
 * with a defined start; both = a range. End without start is rejected.
 */
export const DayEntrySchema = z.object({
  eventId: z.string(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});
export type DayEntry = z.infer<typeof DayEntrySchema>;

export const EventTagSchema = z.object({ eventId: z.string(), tagId: z.string(), isFreeForm: z.boolean() });
export type EventTag = z.infer<typeof EventTagSchema>;

export const EventLinkSchema = z.object({ eventId: z.string(), labelId: z.string(), url: z.string() });
export type EventLink = z.infer<typeof EventLinkSchema>;

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  /** Absent when the event never had a banner. */
  banner: ImageViewSchema.optional(),
  creatorId: z.string(),
  organizationId: z.string(),
  isHidden: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  schedule: z.array(DayEntrySchema),
  tags: z.array(EventTagSchema),
  links: z.array(EventLinkSchema),
});
export type Event = z.infer<typeof EventSchema>;

/** An event opened by id (`GET .../events/:eventId`), with its vote count. */
export const EventWithVotesSchema = EventSchema.extend({ voteCount: z.number() });
export type EventWithVotes = z.infer<typeof EventWithVotesSchema>;

/** An event in the public feed, with its votes and its rank weight (votes + how soon it happens). */
export const FeedEventSchema = EventSchema.extend({ voteCount: z.number(), weight: z.number() });
export type FeedEvent = z.infer<typeof FeedEventSchema>;

/** Body of `POST /organizations/:id/events`. The banner is uploaded apart, once the event exists. */
export type CreateEventInput = {
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  isHidden: boolean;
  schedule: Array<{ date: string; startTime?: string; endTime?: string }>;
  tags: Array<{ tagId: string; isFreeForm: boolean }>;
  links: Array<{ labelId: string; url: string }>;
};

/** System-wide tag. Only `isSystemDefined` tags are shown publicly; the rest are free-form suggestions. */
export const TagSchema = z.object({ id: z.string(), name: z.string(), isSystemDefined: z.boolean() });
export type Tag = z.infer<typeof TagSchema>;

/** System-wide label for an event link (e.g. "Inscrição", "Site do evento"). */
export const LinkLabelSchema = z.object({ id: z.string(), name: z.string() });
export type LinkLabel = z.infer<typeof LinkLabelSchema>;

export const ReportReasonSchema = z.enum(["spam", "offensive_content", "incorrect_information", "duplicate"]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  eventId: z.string(),
  reason: ReportReasonSchema,
  comment: z.string().optional(),
  createdAt: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

export const AuditActionSchema = z.enum([
  "hide_event",
  "unhide_event",
  "apply_shadow_ban",
  "lift_shadow_ban",
  "promote_tag",
  "update_org_threshold",
  "remove_user",
  "change_role",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

/** One moderation/administration action. `actorId` is absent for automatic actions (report threshold). */
export const AuditEntrySchema = z.object({
  id: z.string(),
  actorId: z.string().optional(),
  organizationId: z.string().optional(),
  action: AuditActionSchema,
  targetType: z.string(),
  targetId: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const DeviceStatusValueSchema = z.enum(["pending", "active", "offline", "rejected"]);

export const DeviceSchema = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  name: z.string().optional(),
  location: z.string().optional(),
  organizationId: z.string().optional(),
  status: DeviceStatusValueSchema,
  connectedAt: z.string(),
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const HeartbeatSchema = z.object({
  deviceId: z.string(),
  timestamp: z.string(),
  status: z.string(),
  errors: z.array(z.string()).optional(),
});
export type Heartbeat = z.infer<typeof HeartbeatSchema>;

/** Online = a heartbeat in the last 60 seconds. */
export const DeviceStatusSchema = z.object({ isOnline: z.boolean(), latestHeartbeat: HeartbeatSchema.nullable() });
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

/** Detailed telemetry sent by Puppet. Memory/disk in bytes, uptime in seconds. */
export const DeviceTelemetrySchema = z.object({
  cpuTemp: z.number().optional(),
  memoryUsage: z.number().optional(),
  diskTotal: z.number().optional(),
  diskUsage: z.number().optional(),
  osVersion: z.string().optional(),
  kernelVersion: z.string().optional(),
  puppetVersion: z.string().optional(),
  screenResolution: z.string().optional(),
  hdmiConnected: z.boolean().optional(),
  screenOn: z.boolean().optional(),
  hdmiProtocol: z.string().optional(),
  puppetMemoryUsage: z.number().optional(),
  puppetCpuUsage: z.number().optional(),
  uptime: z.number().optional(),
  networkInfo: z.string().optional(),
  connectedNetwork: z.string().optional(),
  osUsers: z.string().optional(),
  userPermissions: z.string().optional(),
  kiosKModeEnabled: z.boolean().optional(),
  autoLoginEnabled: z.boolean().optional(),
  startupAppConfigured: z.boolean().optional(),
  puppetRunLevel: z.string().optional(),
  puppetStartTime: z.string().optional(),
  connectionHistory: z.array(z.string()).optional(),
  suspendEvents: z.array(z.string()).optional(),
  shutdownTimes: z.array(z.string()).optional(),
  startupTimes: z.array(z.string()).optional(),
  restarts: z.number().optional(),
  crashes: z.number().optional(),
  hdmiDisconnects: z.number().optional(),
  screenPowerChanges: z.number().optional(),
});
export type DeviceTelemetry = z.infer<typeof DeviceTelemetrySchema>;

/** Answer of `GET .../telemetry`: `telemetry` is null until the device sends it for the first time. */
export const DeviceTelemetryResponseSchema = z.object({ telemetry: DeviceTelemetrySchema.nullable() });

export const DeviceLogSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  level: z.string(),
  message: z.string(),
  timestamp: z.string(),
});
export type DeviceLog = z.infer<typeof DeviceLogSchema>;

export const CommandTypeSchema = z.enum(["restart", "shutdown", "update", "open_ssh", "custom", "request_telemetry"]);
export type CommandType = z.infer<typeof CommandTypeSchema>;

export const CommandStatusSchema = z.enum(["pending", "sent", "acknowledged", "completed", "failed"]);
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

export const CommandSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  type: CommandTypeSchema,
  payload: z.record(z.string(), z.unknown()).optional(),
  status: CommandStatusSchema,
  issuedBy: z.string(),
  issuedAt: z.string(),
  completedAt: z.string().optional(),
});
export type Command = z.infer<typeof CommandSchema>;

/**
 * Body of `POST .../commands`. `update` must carry where to download the new
 * Puppet binary (absolute http(s) URL or a path on Puppeteer) and its SHA-256.
 */
export type CreateCommandInput =
  | { type: "update"; payload: { url: string; sha256: string; version?: string } }
  | { type: Exclude<CommandType, "update">; payload?: Record<string, unknown> };

/** `{ success: true }` answers of delete/resend endpoints. */
export const SuccessSchema = z.object({ success: z.literal(true) });

/** Answer of `POST /auth/login`. */
export const LoginResponseSchema = z.object({ userId: z.string(), token: z.string() });

/** Answer of `POST /auth/register`. */
export const RegisterResponseSchema = z.object({ user: UserSchema });

/** Answer of `POST .../vote` (it toggles). */
export const VoteResponseSchema = z.object({ status: z.enum(["voted", "unvoted"]) });

/** Answer of `GET .../vote`. */
export const VoteStatusSchema = z.object({ voted: z.boolean() });

/** Answer of `GET .../report`: whether the logged-in user already reported the event. */
export const ReportStatusSchema = z.object({ reported: z.boolean() });

/** Body of every API error answer. Image errors also carry a `code` telling them apart. */
export const ApiErrorBodySchema = z.object({ error: z.string(), code: z.string().optional() });

/** The kinds of inappropriate content Screening looks for, in the API's order. */
export const SCREENING_CATEGORIES = [
  "nudity", "gore", "violence", "weapons", "hate", "offensive_gesture", "offensive_text",
] as const;
export type ScreeningCategory = typeof SCREENING_CATEGORIES[number];

/** Scores from 0 to 1; a category no engine measured is absent. */
export const ScreeningScoresSchema = z.partialRecord(z.enum(SCREENING_CATEGORIES), z.number());
export type ScreeningScores = z.infer<typeof ScreeningScoresSchema>;

/** Cut-offs of one category: below `lower` Approved, from `upper` on Rejected, in between In Review. */
export const CategoryCutOffsSchema = z.object({ lower: z.number(), upper: z.number() });
export type CategoryCutOffs = z.infer<typeof CategoryCutOffsSchema>;

/** The Screening Policy: cut-offs for every category. */
export const ScreeningPolicySchema = z.record(z.enum(SCREENING_CATEGORIES), CategoryCutOffsSchema);
export type ScreeningPolicy = z.infer<typeof ScreeningPolicySchema>;

/** Answer of `GET /screening-policy`: `null` until a Superadmin sets it. */
export const ScreeningPolicyResponseSchema = z.object({ policy: ScreeningPolicySchema.nullable() });

/** An Image awaiting Image Review, with what a reviewer needs to judge it. */
export const ImageReviewItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["event_banner", "organization_logo"]),
  ownerId: z.string(),
  /** The event's title or the organization's name. */
  ownerName: z.string(),
  organizationId: z.string(),
  uploaderId: z.string(),
  uploaderName: z.string(),
  uploadedAt: z.string(),
  /** Screening could not conclude: no score to go by. */
  notScreened: z.boolean(),
  scores: ScreeningScoresSchema,
  /** Short-lived URL of the picture, for the reviewer to reveal. */
  previewUrl: z.string(),
  thumbhash: z.string(),
});
export type ImageReviewItem = z.infer<typeof ImageReviewItemSchema>;

/** Answer of approving or rejecting an Image. */
export const ImageDecisionSchema = z.object({ state: z.enum(["approved", "rejected"]) });
