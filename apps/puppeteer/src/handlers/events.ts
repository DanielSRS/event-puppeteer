import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { CreateEventInput, Event } from '../types/event.ts';
import { requireAuth } from './users.ts';

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
  if (actor.organizationId !== orgId && actor.role !== 'Superadmin') {
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
  if (body.bannerImage !== undefined) event.bannerImage = body.bannerImage;

  event.schedule.forEach(s => s.eventId = event.id);
  event.tags.forEach(t => t.eventId = event.id);
  event.links.forEach(l => l.eventId = event.id);

  return await io.eventRepo.create(event);
}

export async function listEventsHandler(orgId: string, io: AppIO) {
  const allEvents = await io.eventRepo.listByOrganization(orgId);
  
  // exclude deleted, hidden, and expired events
  const publicEvents = allEvents.filter(e => !e.isDeleted && !e.isHidden && !isEventExpired(e));

  // remove free-form tags from response
  return publicEvents.map(e => ({
    ...e,
    tags: e.tags.filter(t => !t.isFreeForm)
  }));
}

export async function getEventHandler(orgId: string, eventId: string, io: AppIO) {
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) {
    throw new Error('NOT_FOUND');
  }
  return event;
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
