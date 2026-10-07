import { eq } from 'drizzle-orm';
import type { TagRepository } from '../index.ts';
import type { Tag } from '../../types/tag.ts';
import { tag } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleTagRepository implements TagRepository {
  constructor(private db: any) {}

  async create(newTag: Tag): Promise<Tag> {
    const id = newTag.id || randomUUID();
    const t = { ...newTag, id };
    await this.db.insert(tag).values(t);
    return t;
  }

  async getAll(): Promise<Tag[]> {
    const rows = await this.db.select().from(tag);
    return rows as Tag[];
  }

  async getById(id: string): Promise<Tag | null> {
    const rows = await this.db.select().from(tag).where(eq(tag.id, id));
    if (rows.length === 0) return null;
    return rows[0] as Tag;
  }

  async update(id: string, updates: Partial<Tag>): Promise<Tag | null> {
    const rows = await this.db.update(tag).set(updates).where(eq(tag.id, id)).returning();
    if (rows.length === 0) return null;
    return rows[0] as Tag;
  }
}
