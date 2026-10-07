/* utils/events.ts */

/* SERVER ONLY: SHARED BY THE LIKE AND SUBSCRIBE ROUTES */

import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventLikesTable, eventSubscriptionsTable, eventsTable } from "@/db/schema";

export async function EventExists(eventId: number): Promise<boolean> {
  const [event] = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId))
    .limit(1);

  return Boolean(event);
};

export async function CountEvent(eventId: number) {
  const [[likes], [subscriptions]] = await Promise.all([
    db.select({ total: count() }).from(eventLikesTable).where(eq(eventLikesTable.eventId, eventId)),
    db.select({ total: count() }).from(eventSubscriptionsTable).where(eq(eventSubscriptionsTable.eventId, eventId)),
  ]);

  return { likes: Number(likes?.total ?? 0), subscriptions: Number(subscriptions?.total ?? 0) };
};

export function ParseEventId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
