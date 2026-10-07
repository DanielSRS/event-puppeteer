import type { AppIO } from '../io/index.ts';
import { requireAuth } from './users.ts';

export async function voteHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  
  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) {
    throw new Error('NOT_FOUND');
  }

  const hasVoted = await io.voteRepo.existsByUserAndEvent(actor.id, eventId);

  if (hasVoted) {
    await io.voteRepo.delete(actor.id, eventId);
    return { status: 'unvoted' as const };
  } else {
    await io.voteRepo.create({
      userId: actor.id,
      eventId: eventId,
      createdAt: new Date().toISOString()
    });
    return { status: 'voted' as const };
  }
}

export async function getVoteStatusHandler(request: Request, orgId: string, eventId: string, io: AppIO) {
  const actor = await requireAuth(request, io);

  const event = await io.eventRepo.getById(eventId);
  if (!event || event.organizationId !== orgId || event.isDeleted) {
    throw new Error('NOT_FOUND');
  }

  const hasVoted = await io.voteRepo.existsByUserAndEvent(actor.id, eventId);
  return { voted: hasVoted };
}
