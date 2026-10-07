// Shared types mirrored from the puppeteer backend (src/types/*)
// Keep in sync with the API contract.

export type UserRole = 'Superadmin' | 'Admin' | 'Moderator' | 'Member';

interface BaseUser {
  id: string;
  firstName: string;
  lastName: string;
  normalizedName: string;
  email: string;
  isShadowBanned: boolean;
}

// A Superadmin lives above organizations and has no organizationId;
// everyone else always belongs to exactly one.
export type SuperadminUser = BaseUser & { role: 'Superadmin' };
export type OrgUser = BaseUser & { role: Exclude<UserRole, 'Superadmin'>; organizationId: string };
export type User = SuperadminUser | OrgUser;

export function UserOrgId(user: User | null | undefined): string | null {
  return user && user.role !== 'Superadmin' ? user.organizationId : null;
}

export interface DayEntry {
  eventId: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface EventTag {
  eventId: string;
  tagId: string;
  isFreeForm: boolean;
}

export interface EventLink {
  eventId: string;
  labelId: string;
  url: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  creatorId: string;
  organizationId: string;
  isHidden: boolean;
  isDeleted: boolean;
  createdAt: string;
  schedule: DayEntry[];
  tags: EventTag[];
  links: EventLink[];
}

export interface FeedEvent extends Event {
  voteCount: number;
  weight: number;
}

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  bannerImage?: string;
  isHidden: boolean;
  schedule: Array<{ date: string; startTime?: string; endTime?: string }>;
  tags: Array<{ tagId: string; isFreeForm: boolean }>;
  links: Array<{ labelId: string; url: string }>;
}

export interface Tag {
  id: string;
  name: string;
  isSystemDefined: boolean;
}

export interface LinkLabel {
  id: string;
  name: string;
}

export interface Report {
  id: string;
  reporterId: string;
  eventId: string;
  reason: 'spam' | 'offensive_content' | 'incorrect_information' | 'duplicate';
  comment?: string;
  createdAt: string;
}

export type AuditAction =
  | 'hide_event'
  | 'unhide_event'
  | 'apply_shadow_ban'
  | 'lift_shadow_ban'
  | 'promote_tag'
  | 'update_org_threshold';

export interface AuditEntry {
  id: string;
  actorId: string;
  organizationId?: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  url?: string;
  colorScheme?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  shadowBanThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationInput = Omit<Organization, 'id' | 'shadowBanThreshold' | 'createdAt' | 'updatedAt'> & {
  shadowBanThreshold?: number;
};

export interface Device {
  id: string;
  name?: string;
  location?: string;
  organizationId?: string;
  status: 'pending' | 'active' | 'offline' | 'rejected';
  connectedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Heartbeat {
  deviceId: string;
  timestamp: string;
  status: string;
  errors?: string[];
}

export interface DeviceStatus {
  isOnline: boolean;
  latestHeartbeat: Heartbeat | null;
}

// Sent by the Puppet client; memory/disk in bytes, uptime in seconds
export interface DeviceTelemetry {
  cpuTemp?: number;
  memoryUsage?: number;
  diskTotal?: number;
  diskUsage?: number;
  osVersion?: string;
  kernelVersion?: string;
  puppetVersion?: string;
  puppetMemoryUsage?: number;
  uptime?: number;
  networkInfo?: string;
  screenResolution?: string;
  hdmiConnected?: boolean;
  screenOn?: boolean;
}

export interface DeviceLog {
  id: string;
  deviceId: string;
  level: string;
  message: string;
  timestamp: string;
}

export type CommandType = 'restart' | 'shutdown' | 'update' | 'open_ssh' | 'custom' | 'request_telemetry';
export type CommandStatus = 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';

export interface Command {
  id: string;
  deviceId: string;
  type: CommandType;
  payload?: Record<string, unknown>;
  status: CommandStatus;
  issuedBy: string;
  issuedAt: string;
  completedAt?: string;
}

export type CreateCommandInput =
  | { type: 'update'; payload: { url: string; sha256: string; version?: string } }
  | { type: Exclude<CommandType, 'update'>; payload?: Record<string, unknown> };
