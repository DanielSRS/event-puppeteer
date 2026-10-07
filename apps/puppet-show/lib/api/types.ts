// Shared types mirrored from the puppeteer backend (src/types/*)
// Keep in sync with the API contract.

export type UserRole = 'Superadmin' | 'Admin' | 'Moderator' | 'Member';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  normalizedName: string;
  email: string;
  organizationId: string;
  role: UserRole;
  isShadowBanned: boolean;
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
}

export type OrganizationInput = Omit<Organization, 'id' | 'shadowBanThreshold'> & {
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
