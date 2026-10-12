import { and, desc, eq } from 'drizzle-orm';
import type { EventRepository } from '../index.ts';
import type { Event } from '../../types/event.ts';
import { event } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';
import { randomUUID } from 'node:crypto';

type EventRow = typeof event.$inferSelect;

/** Events stored in the `event` table. */
export class DrizzleEventRepository implements EventRepository {
  constructor(private db: Database) {}

  async create(e: Event): Promise<Event> {
    const id = e.id || randomUUID();
    const newEvent = { ...e, id };
    await this.db.insert(event).values({
      ...newEvent,
      createdAt: new Date(newEvent.createdAt)
    });
    return newEvent;
  }

  async getById(id: string): Promise<Event | null> {
    const rows = await this.db.select().from(event).where(eq(event.id, id));
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async listByOrganization(orgId: string): Promise<Event[]> {
    const rows = await this.db.select().from(event).where(eq(event.organizationId, orgId));
    return rows.map(r => this.mapToDomain(r));
  }

  /** Newest first. */
  async listByCreator(orgId: string, creatorId: string): Promise<Event[]> {
    const rows = await this.db.select().from(event)
      .where(and(eq(event.organizationId, orgId), eq(event.creatorId, creatorId)))
      .orderBy(desc(event.createdAt));
    return rows.map(r => this.mapToDomain(r));
  }

  async softDelete(id: string): Promise<Event | null> {
    return this.update(id, { isDeleted: true });
  }

  async softDeleteByCreator(creatorId: string): Promise<number> {
    const rows = await this.db.update(event)
      .set({ isDeleted: true })
      .where(and(eq(event.creatorId, creatorId), eq(event.isDeleted, false)))
      .returning({ id: event.id });
    return rows.length;
  }

  async update(id: string, updates: Partial<Event>): Promise<Event | null> {
    const { createdAt, ...rest } = updates;
    const rows = await this.db.update(event)
      .set({ ...rest, ...(createdAt !== undefined ? { createdAt: new Date(createdAt) } : {}) })
      .where(eq(event.id, id))
      .returning();
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  /**
   * Converts a row to the domain Event: timestamps become ISO strings and null
   * optional columns are left out (Elysia's response validation rejects null for
   * optional fields).
   */
  private mapToDomain(row: EventRow): Event {
    const { latitude, longitude, createdAt, ...rest } = row;
    return {
      ...rest,
      createdAt: createdAt.toISOString(),
      ...(latitude !== null ? { latitude } : {}),
      ...(longitude !== null ? { longitude } : {})
    };
  }
}
