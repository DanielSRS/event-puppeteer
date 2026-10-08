import { eq, sql } from 'drizzle-orm';
import type { TagRepository } from '../index.ts';
import type { Tag } from '../../types/tag.ts';
import { tag } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';
import { randomUUID } from 'node:crypto';

/** Tags stored in the `tag` table. */
export class DrizzleTagRepository implements TagRepository {
  constructor(private db: Database) {}

  async create(newTag: Tag): Promise<Tag> {
    const id = newTag.id || randomUUID();
    const t = { ...newTag, id };
    await this.db.insert(tag).values(t);
    return t;
  }

  async getAll(): Promise<Tag[]> {
    return await this.db.select().from(tag);
  }

  async getById(id: string): Promise<Tag | null> {
    const rows = await this.db.select().from(tag).where(eq(tag.id, id));
    return rows[0] ?? null;
  }

  /** Compares trimmed names case-insensitively. */
  async findByName(name: string): Promise<Tag | null> {
    const rows = await this.db.select().from(tag)
      .where(sql`lower(trim(${tag.name})) = lower(trim(${name}))`)
      .limit(1);
    return rows[0] ?? null;
  }

  async update(id: string, updates: Partial<Tag>): Promise<Tag | null> {
    const rows = await this.db.update(tag).set(updates).where(eq(tag.id, id)).returning();
    return rows[0] ?? null;
  }
}
