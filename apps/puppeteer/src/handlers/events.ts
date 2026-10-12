import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { CreateEventInput, Event, EventView } from '../types/event.ts';
import { requireAuth } from './users.ts';
import { organizationOf, type User } from '../types/user.ts';
import { hasAtLeastRole } from '../utils/roles.ts';
import { imageViewFor } from './images.ts';

function isEventExpired(event: Event): boolean {
  if (event.schedule.length === 0) return true;
  
  const latestDateStr = event.schedule.reduce((latest, entry) => {
    return entry.date > latest ? entry.date : latest;
  }, event.schedule[0]!.date);

  const today = new Date().toISOString().split('T')[0]!;
  return latestDateStr < today;
}

export async function createEventHandler(request: Request, orgId: string, body: CreateEventInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  if (organizationOf(actor) !== orgId && actor.role !== 'Superadmin') {
    throw new Error('FORBIDDEN');
  }

  for (const entry of body.schedule) {
    if (entry.endTime && !entry.startTime) {
      throw new Error('BAD_REQUEST');
    }
  }

  const event: Event = {
    id: randomUUID(),
    title: body.title,
    description: body.description,
    location: body.location,
    creatorId: actor.id,
    organizationId: orgId,
    isHidden: body.isHidden,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    schedule: body.schedule.map(s => ({ eventId: '', ...s })),
    tags: body.tags.map(t => ({ eventId: '', ...t })),
    links: body.links.map(l => ({ eventId: '', ...l }))
  };

  if (body.latitude !== undefined) event.latitude = body.latitude;
  if (body.longitude !== undefined) event.longitude = body.longitude;

  event.schedule.forEach(s => s.eventId = event.id);
  event.tags.forEach(t => t.eventId = event.id);
  event.links.forEach(l => l.eventId = event.id);

  return await io.eventRepo.create(event);
}

export async function listEventsHandler(request: Request, orgId: string, io: AppIO) {
  const allEvents = await io.eventRepo.listByOrganization(orgId);
  const viewerId = await io.auth.getSessionUserId(request);
  
  const publicEvents = [];
  for (const e of allEvents) {
    if (e.isDeleted || e.isHidden || isEventExpired(e)) continue;

    const creator = await io.userRepo.getById(e.creatorId);
    if (creator?.isShadowBanned && creator.id !== viewerId) continue;

    publicEvents.push(e);
  }

  // remove free-form tags from response
  return await Promise.all(publicEvents.map(async e => withBanner({
    ...e,
    tags: e.tags.filter(t => !t.isFreeForm)
  }, viewerId, io)));
}

/** The Event with its banner resolved for `viewerId` (absent when it never had one). */
async function withBanner(event: Event, viewerId: string | null, io: AppIO): Promise<EventView> {
  const banner = await imageViewFor('event_banner', event.id, viewerId, io);
  return { ...event, ...(banner ? { banner } : {}) };
}

/**
 * Lists the logged-in User's own Events in an Organization, for their dashboard.
 * Unlike the public listing it includes hidden and expired Events and keeps
 * free-form Tags (they belong to the creator); deleted Events are left out.
 * Newest first.
 * @throws UNAUTHORIZED without a valid session.
 * @throws FORBIDDEN when the actor belongs to another Organization and is not a Superadmin.
 */
export async function listMyEventsHandler(request: Request, orgId: string, io: AppIO): Promise<EventView[]> {
  const actor = await requireAuth(request, io);
  if (actor.role !== 'Superadmin' && organizationOf(actor) !== orgId) throw new Error('FORBIDDEN');

  const events = await io.eventRepo.listByCreator(orgId, actor.id);
  return await Promise.all(events.filter(e => !e.isDeleted).map(e => withBanner(e, actor.id, io)));
}

/**
 * Gets one Event of an Organization, with its Vote count.
 *
 * Everyone sees an Event that is neither hidden nor authored by a shadow-banned User.
 * Its creator always sees it (a shadow-banned author must not notice the ban), and so do
 * Moderators+ of the Organization and Superadmins, who moderate hidden Events and
 * shadow-banned authors from the report queue.
 * @throws NOT_FOUND when the Event doesn't exist, belongs to another Organization, is
 * deleted, or is not visible to the viewer.
 */
export async function getEventHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) {
    throw new Error('NOT_FOUND');
  }

  const viewerId = await io.auth.getSessionUserId(request);
  const viewer = viewerId ? await io.userRepo.getById(viewerId) : null;
  const privileged = viewer !== null && (viewer.id === event.creatorId || canModerate(viewer, orgId));

  if (!privileged) {
    const creator = await io.userRepo.getById(event.creatorId);
    if (event.isHidden || !creator || creator.isShadowBanned) {
      throw new Error('NOT_FOUND');
    }
  }

  return { ...await withBanner(event, viewerId, io), voteCount: await io.voteRepo.countByEvent(event.id) };
}

/** Whether `user` moderates `orgId`: a Moderator+ of it, or a Superadmin. */
function canModerate(user: User, orgId: string): boolean {
  return user.role === 'Superadmin' || (organizationOf(user) === orgId && hasAtLeastRole(user.role, 'Moderator'));
}

export async function deleteEventHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  const event = await io.eventRepo.getById(eventId);
  
  if (!event || event.organizationId !== orgId) {
    throw new Error('NOT_FOUND');
  }

  // only creator or Superadmin can soft-delete
  if (event.creatorId !== actor.id && actor.role !== 'Superadmin') {
    throw new Error('FORBIDDEN');
  }

  const deletedEvent = await io.eventRepo.softDelete(eventId);
  if (!deletedEvent) throw new Error('NOT_FOUND');
  return deletedEvent;
}
