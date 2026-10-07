import { eq } from 'drizzle-orm';
import type { LinkLabelRepository } from '../index.ts';
import type { LinkLabel } from '../../types/tag.ts';
import { linkLabel } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleLinkLabelRepository implements LinkLabelRepository {
  constructor(private db: any) {}

  async create(label: LinkLabel): Promise<LinkLabel> {
    const id = label.id || randomUUID();
    const l = { ...label, id };
    await this.db.insert(linkLabel).values(l);
    return l;
  }

  async getAll(): Promise<LinkLabel[]> {
    const rows = await this.db.select().from(linkLabel);
    return rows as LinkLabel[];
  }

  async getById(id: string): Promise<LinkLabel | null> {
    const rows = await this.db.select().from(linkLabel).where(eq(linkLabel.id, id));
    if (rows.length === 0) return null;
    return rows[0] as LinkLabel;
  }
}
