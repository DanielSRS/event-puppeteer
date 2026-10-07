import { eq } from 'drizzle-orm';
import type { EventRepository } from '../index.ts';
import type { Event } from '../../types/event.ts';
import { event } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleEventRepository implements EventRepository {
  constructor(private db: any) {}

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
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByOrganization(orgId: string): Promise<Event[]> {
    const rows = await this.db.select().from(event).where(eq(event.organizationId, orgId));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async softDelete(id: string): Promise<Event | null> {
    return this.update(id, { isDeleted: true });
  }

  async update(id: string, updates: Partial<Event>): Promise<Event | null> {
    const pgUpdates: any = { ...updates };
    if (updates.createdAt) pgUpdates.createdAt = new Date(updates.createdAt);
    
    const rows = await this.db.update(event).set(pgUpdates).where(eq(event.id, id)).returning();
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  private mapToDomain(row: any): Event {
    return {
      ...row,
      createdAt: row.createdAt.toISOString()
    };
  }
}
