import { eq, desc } from 'drizzle-orm';
import type { AuditRepository } from '../index.ts';
import type { AuditEntry } from '../../types/moderation.ts';
import { audit } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleAuditRepository implements AuditRepository {
  constructor(private db: any) {}

  async create(entry: AuditEntry): Promise<AuditEntry> {
    const id = entry.id || randomUUID();
    const newEntry = { ...entry, id };
    await this.db.insert(audit).values({
      ...newEntry,
      createdAt: new Date(newEntry.createdAt)
    });
    return newEntry;
  }

  async listByOrganization(orgId: string): Promise<AuditEntry[]> {
    const rows = await this.db.select().from(audit).where(eq(audit.organizationId, orgId)).orderBy(desc(audit.createdAt));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async listByActor(actorId: string): Promise<AuditEntry[]> {
    const rows = await this.db.select().from(audit).where(eq(audit.actorId, actorId)).orderBy(desc(audit.createdAt));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async listByTarget(targetId: string): Promise<AuditEntry[]> {
    const rows = await this.db.select().from(audit).where(eq(audit.targetId, targetId)).orderBy(desc(audit.createdAt));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): AuditEntry {
    return {
      ...row,
      createdAt: row.createdAt.toISOString()
    };
  }
}
