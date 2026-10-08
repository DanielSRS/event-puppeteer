import { eq, sql } from 'drizzle-orm';
import type { LinkLabelRepository } from '../index.ts';
import type { LinkLabel } from '../../types/tag.ts';
import { linkLabel } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';
import { randomUUID } from 'node:crypto';

/** Link Labels stored in the `link_label` table. */
export class DrizzleLinkLabelRepository implements LinkLabelRepository {
  constructor(private db: Database) {}

  async create(label: LinkLabel): Promise<LinkLabel> {
    const id = label.id || randomUUID();
    const l = { ...label, id };
    await this.db.insert(linkLabel).values(l);
    return l;
  }

  async getAll(): Promise<LinkLabel[]> {
    return await this.db.select().from(linkLabel);
  }

  async getById(id: string): Promise<LinkLabel | null> {
    const rows = await this.db.select().from(linkLabel).where(eq(linkLabel.id, id));
    return rows[0] ?? null;
  }

  /** Compares trimmed names case-insensitively. */
  async findByName(name: string): Promise<LinkLabel | null> {
    const rows = await this.db.select().from(linkLabel)
      .where(sql`lower(trim(${linkLabel.name})) = lower(trim(${name}))`)
      .limit(1);
    return rows[0] ?? null;
  }
}
