// Typed HTTP client for the puppeteer backend API.
// Requests go to /api on the same origin (proxied by next.config.ts) and carry
// the better-auth session as a Bearer token.

import type {
  User, UserRole, Event, CreateEventInput, FeedEvent,
  Tag, LinkLabel, Report, AuditEntry, Organization, OrganizationInput, Device,
} from './types';
import { GetToken } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = GetToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `API ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Auth ─────────────────────────────────────────────────────────────────────

  auth: {
    register: (body: { firstName: string; lastName: string; email: string; password: string }, orgId?: string) =>
      apiFetch<{ user: User; token: string }>(`/auth/register${orgId ? `?orgId=${orgId}` : ''}`, {
        method: 'POST', body: JSON.stringify(body),
      }),

    login: (body: { email: string; password: string }) =>
      apiFetch<{ userId: string; token: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify(body),
      }),

    me: () => apiFetch<User>('/auth/me'),
  },

  // ── Organizations ─────────────────────────────────────────────────────────────

  organizations: {
    list: () => apiFetch<Organization[]>('/organizations'),
    get: (id: string) => apiFetch<Organization>(`/organizations/${id}`),
    create: (body: OrganizationInput) =>
      apiFetch<Organization>('/organizations', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<OrganizationInput>) =>
      apiFetch<Organization>(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    feed: (orgId: string) => apiFetch<FeedEvent[]>(`/organizations/${orgId}/feed`),
  },

  // ── Events ───────────────────────────────────────────────────────────────────

  events: {
    list: (orgId: string) => apiFetch<Event[]>(`/organizations/${orgId}/events`),
    get: (orgId: string, eventId: string) => apiFetch<Event>(`/organizations/${orgId}/events/${eventId}`),
    create: (orgId: string, body: CreateEventInput) =>
      apiFetch<Event>(`/organizations/${orgId}/events`, { method: 'POST', body: JSON.stringify(body) }),
    delete: (orgId: string, eventId: string) =>
      apiFetch<{ success: true }>(`/organizations/${orgId}/events/${eventId}`, { method: 'DELETE' }),
    vote: (orgId: string, eventId: string) =>
      apiFetch<{ status: 'voted' | 'unvoted' }>(`/organizations/${orgId}/events/${eventId}/vote`, { method: 'POST' }),
    getVoteStatus: (orgId: string, eventId: string) =>
      apiFetch<{ voted: boolean }>(`/organizations/${orgId}/events/${eventId}/vote`),
    report: (orgId: string, eventId: string, body: { reason: string; comment?: string }) =>
      apiFetch<Report>(`/organizations/${orgId}/events/${eventId}/report`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    hide: (orgId: string, eventId: string) =>
      apiFetch<Event>(`/organizations/${orgId}/events/${eventId}/hide`, { method: 'POST' }),
    unhide: (orgId: string, eventId: string) =>
      apiFetch<Event>(`/organizations/${orgId}/events/${eventId}/unhide`, { method: 'POST' }),
  },

  // ── Users ────────────────────────────────────────────────────────────────────

  users: {
    list: (orgId: string) => apiFetch<User[]>(`/organizations/${orgId}/users`),
    changeRole: (orgId: string, userId: string, role: UserRole) =>
      apiFetch<User>(`/organizations/${orgId}/users/${userId}/role`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      }),
    remove: (orgId: string, userId: string) =>
      apiFetch<{ success: true }>(`/organizations/${orgId}/users/${userId}`, { method: 'DELETE' }),
  },

  // ── Moderation ───────────────────────────────────────────────────────────────

  moderation: {
    listReports: (orgId: string) => apiFetch<Report[]>(`/organizations/${orgId}/reports`),
    listShadowBans: (orgId: string) => apiFetch<User[]>(`/organizations/${orgId}/shadow-bans`),
    liftShadowBan: (orgId: string, userId: string) =>
      apiFetch<User>(`/organizations/${orgId}/shadow-bans/${userId}`, { method: 'DELETE' }),
    listAudit: (orgId: string) => apiFetch<AuditEntry[]>(`/organizations/${orgId}/audit`),
  },

  // ── Tags & Link Labels ────────────────────────────────────────────────────────

  tags: {
    list: () => apiFetch<Tag[]>('/tags'),
    create: (name: string, isSystemDefined: boolean) =>
      apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name, isSystemDefined }) }),
    promote: (tagId: string) =>
      apiFetch<Tag>(`/tags/${tagId}/promote`, { method: 'POST' }),
  },

  linkLabels: {
    list: () => apiFetch<LinkLabel[]>('/link-labels'),
    create: (name: string) =>
      apiFetch<LinkLabel>('/link-labels', { method: 'POST', body: JSON.stringify({ name }) }),
  },

  // ── Devices ──────────────────────────────────────────────────────────────────

  devices: {
    listPending: () => apiFetch<Device[]>('/devices/pending'),
    approve: (deviceId: string, body: { name: string; location: string; organizationId?: string }) =>
      apiFetch<Device>(`/devices/${deviceId}/approve`, { method: 'POST', body: JSON.stringify(body) }),
    reject: (deviceId: string) =>
      apiFetch<Device>(`/devices/${deviceId}/reject`, { method: 'POST' }),
  },
};
