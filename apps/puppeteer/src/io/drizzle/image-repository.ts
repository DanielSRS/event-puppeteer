import { and, asc, count, desc, eq, gte, isNull } from 'drizzle-orm';
import type { ImageRepository } from '../index.ts';
import type { Image, ImageKind, ImageState } from '../../types/image.ts';
import { image } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';

type ImageRow = typeof image.$inferSelect;

/** Images stored in the `image` table. */
export class DrizzleImageRepository implements ImageRepository {
  constructor(private db: Database) {}

  async create(img: Image): Promise<Image> {
    await this.db.insert(image).values({
      ...img,
      uploadedAt: new Date(img.uploadedAt),
      decidedAt: img.decidedAt !== undefined ? new Date(img.decidedAt) : null,
      detachedAt: img.detachedAt !== undefined ? new Date(img.detachedAt) : null
    });
    return img;
  }

  async getById(id: string): Promise<Image | null> {
    const rows = await this.db.select().from(image).where(eq(image.id, id));
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async countByUploaderSince(uploaderId: string, since: Date): Promise<number> {
    const rows = await this.db.select({ n: count() }).from(image)
      .where(and(eq(image.uploaderId, uploaderId), gte(image.uploadedAt, since)));
    return rows[0]?.n ?? 0;
  }

  async currentFor(kind: ImageKind, ownerId: string): Promise<{ latest: Image | null; approved: Image | null }> {
    const attached = and(eq(image.kind, kind), eq(image.ownerId, ownerId), isNull(image.detachedAt));
    const [latest] = await this.db.select().from(image).where(attached).orderBy(desc(image.uploadedAt)).limit(1);
    const [approved] = await this.db.select().from(image)
      .where(and(attached, eq(image.state, 'approved')))
      .orderBy(desc(image.uploadedAt)).limit(1);
    return {
      latest: latest ? this.mapToDomain(latest) : null,
      approved: approved ? this.mapToDomain(approved) : null
    };
  }

  async detachAll(kind: ImageKind, ownerId: string, at: Date): Promise<void> {
    await this.db.update(image).set({ detachedAt: at })
      .where(and(eq(image.kind, kind), eq(image.ownerId, ownerId), isNull(image.detachedAt)));
  }

  async listInReview(): Promise<Image[]> {
    const rows = await this.db.select().from(image).where(eq(image.state, 'in_review')).orderBy(asc(image.uploadedAt));
    return rows.map(row => this.mapToDomain(row));
  }

  async decide(id: string, state: Exclude<ImageState, 'in_review'>, reviewerId: string, at: Date): Promise<Image | null> {
    const rows = await this.db.update(image)
      .set({ state, decidedBy: reviewerId, decidedAt: at })
      .where(and(eq(image.id, id), eq(image.state, 'in_review')))
      .returning();
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  /** Timestamps become ISO strings and null optional columns are left out. */
  private mapToDomain(row: ImageRow): Image {
    const { decidedBy, decidedAt, detachedAt, uploadedAt, kind, state, ...rest } = row;
    return {
      ...rest,
      kind: kind as ImageKind,
      state: state as ImageState,
      uploadedAt: uploadedAt.toISOString(),
      ...(decidedBy !== null ? { decidedBy } : {}),
      ...(decidedAt !== null ? { decidedAt: decidedAt.toISOString() } : {}),
      ...(detachedAt !== null ? { detachedAt: detachedAt.toISOString() } : {})
    };
  }
}
