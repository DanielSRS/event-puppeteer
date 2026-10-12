import type { AppIO } from '../io/index.ts';
import type { Event } from '../types/event.ts';
import { imageViewFor } from './images.ts';

function isEventExpired(event: Event, todayStr: string): boolean {
  if (event.schedule.length === 0) return true;
  const latestDateStr = event.schedule.reduce((latest, entry) => {
    return entry.date > latest ? entry.date : latest;
  }, event.schedule[0]!.date);
  return latestDateStr < todayStr;
}

function getNextDateDaysAway(event: Event, todayStr: string): number {
  if (event.schedule.length === 0) return 9999;
  
  const upcomingDates = event.schedule
    .map(s => s.date)
    .filter(d => d >= todayStr)
    .sort();
    
  if (upcomingDates.length === 0) return 9999;
  
  const targetDate = new Date(upcomingDates[0]!);
  const todayDate = new Date(todayStr);
  const diffTime = Math.abs(targetDate.getTime() - todayDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
}

/**
 * The weighted feed kiosks show. Kiosks have no viewer, so each banner is the latest
 * Approved Image, or only the Placeholder while none is Approved.
 */
export async function eventFeedHandler(orgId: string, io: AppIO) {
  const allEvents = await io.eventRepo.listByOrganization(orgId);
  const todayStr = new Date().toISOString().split('T')[0]!;
  
  const feedItems = [];

  for (const event of allEvents) {
    if (event.isDeleted || event.isHidden || isEventExpired(event, todayStr)) {
      continue;
    }

    const creator = await io.userRepo.getById(event.creatorId);
    if (!creator || creator.isShadowBanned) {
      continue;
    }

    const voteCount = await io.voteRepo.countByEvent(event.id);
    const daysAway = getNextDateDaysAway(event, todayStr);
    
    // Weighting algorithm: high votes + upcoming dates first
    // E.g., 100 points per vote. Max 300 points for being today, minus 10 per day away.
    const temporalScore = Math.max(0, 300 - daysAway * 10);
    const weight = voteCount * 100 + temporalScore;

    const banner = await imageViewFor('event_banner', event.id, null, io);
    feedItems.push({
      ...event,
      ...(banner ? { banner } : {}),
      tags: event.tags.filter(t => !t.isFreeForm),
      voteCount,
      weight
    });
  }

  // Sort descending by weight
  feedItems.sort((a, b) => b.weight - a.weight);

  return feedItems;
}
