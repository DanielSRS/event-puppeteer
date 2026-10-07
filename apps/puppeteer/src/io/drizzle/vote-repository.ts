import { eq, and } from 'drizzle-orm';
import type { VoteRepository } from '../index.ts';
import type { Vote } from '../../types/vote.ts';
import { vote } from '../../db/schema.ts';

export class DrizzleVoteRepository implements VoteRepository {
  constructor(private db: any) {}

  async create(v: Vote): Promise<Vote> {
    await this.db.insert(vote).values({
      ...v,
      createdAt: new Date(v.createdAt)
    }).onConflictDoNothing(); // prevent duplicate vote errors
    return v;
  }

  async delete(userId: string, eventId: string): Promise<boolean> {
    const rows = await this.db.delete(vote).where(and(eq(vote.userId, userId), eq(vote.eventId, eventId))).returning();
    return rows.length > 0;
  }

  async countByEvent(eventId: string): Promise<number> {
    const rows = await this.db.select().from(vote).where(eq(vote.eventId, eventId));
    return rows.length;
  }

  async existsByUserAndEvent(userId: string, eventId: string): Promise<boolean> {
    const rows = await this.db.select().from(vote).where(and(eq(vote.userId, userId), eq(vote.eventId, eventId)));
    return rows.length > 0;
  }

  async listByEvent(eventId: string): Promise<Vote[]> {
    const rows = await this.db.select().from(vote).where(eq(vote.eventId, eventId));
    return rows.map((r: any) => ({
      userId: r.userId,
      eventId: r.eventId,
      createdAt: r.createdAt.toISOString()
    }));
  }
}
