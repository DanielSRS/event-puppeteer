import type { Organization } from '../types/organization.ts';
import type { User } from '../types/user.ts';
import type { Tag, LinkLabel } from '../types/tag.ts';
import type { Event } from '../types/event.ts';
import type { Vote } from '../types/vote.ts';
import type { Heartbeat, DeviceLog, DeviceTelemetry } from '../types/telemetry.ts';
import type { Command } from '../types/command.ts';
import type { Device } from '../types/device.ts';
import type { Report, AuditEntry } from '../types/moderation.ts';

export interface OrganizationRepository {
  create(org: Omit<Organization, 'id'>): Promise<Organization>;
  getById(id: string): Promise<Organization | null>;
  getAll(): Promise<Organization[]>;
  update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null>;
}

export interface UserRepository {
  create(user: User): Promise<User>;
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  listByOrganization(orgId: string): Promise<User[]>;
  update(id: string, updates: Partial<User>): Promise<User | null>;
  searchByName(orgId: string, query: string): Promise<User[]>;
  delete(id: string): Promise<boolean>;
}

export interface TagRepository {
  create(tag: Tag): Promise<Tag>;
  getAll(): Promise<Tag[]>;
  getById(id: string): Promise<Tag | null>;
  update(id: string, updates: Partial<Tag>): Promise<Tag | null>;
}

export interface LinkLabelRepository {
  create(label: LinkLabel): Promise<LinkLabel>;
  getAll(): Promise<LinkLabel[]>;
  getById(id: string): Promise<LinkLabel | null>;
}

export interface EventRepository {
  create(event: Event): Promise<Event>;
  getById(id: string): Promise<Event | null>;
  listByOrganization(orgId: string): Promise<Event[]>;
  softDelete(id: string): Promise<Event | null>;
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
}

export interface AuthSession {
  token: string;
  userId: string;
}

export interface AuthProvider {
  signUp(email: string, password: string, name: string): Promise<AuthSession>;
  signIn(email: string, password: string): Promise<AuthSession>;
  getSessionUserId(request: Request): Promise<string | null>;
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
  auth: AuthProvider;
}

export function createRealIO(): AppIO {
  throw new Error("Real IO not implemented yet");
}
