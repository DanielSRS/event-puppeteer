import type { Organization } from '../types/organization.ts';
import type { User } from '../types/user.ts';
import type { Tag, LinkLabel } from '../types/tag.ts';
import type { Event } from '../types/event.ts';

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
  auth: AuthProvider;
}

export function createRealIO(): AppIO {
  throw new Error("Real IO not implemented yet");
}
