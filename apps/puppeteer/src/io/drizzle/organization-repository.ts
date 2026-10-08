import { eq } from 'drizzle-orm';
import type { OrganizationRepository } from '../index.ts';
import type { Organization } from '../../types/organization.ts';
import { organization } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';
import { randomUUID } from 'node:crypto';

/** A row of the `organization` table as Drizzle returns it. */
type OrganizationRow = typeof organization.$inferSelect;

/** Organizations stored in the `organization` table. */
export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private db: Database) {}

  async create(org: Omit<Organization, 'id'>): Promise<Organization> {
    const id = randomUUID();
    const newOrg = { id, ...org };
    await this.db.insert(organization).values({
      ...newOrg,
      createdAt: new Date(newOrg.createdAt),
      updatedAt: new Date(newOrg.updatedAt)
    });
    return newOrg;
  }

  async getById(id: string): Promise<Organization | null> {
    const rows = await this.db.select().from(organization).where(eq(organization.id, id));
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const rows = await this.db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async getAll(): Promise<Organization[]> {
    const rows = await this.db.select().from(organization);
    return rows.map((row) => this.mapToDomain(row));
  }

  async update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null> {
    const { createdAt, updatedAt, ...fields } = updates;
    const rows = await this.db.update(organization).set({
      ...fields,
      ...(createdAt !== undefined ? { createdAt: new Date(createdAt) } : {}),
      ...(updatedAt !== undefined ? { updatedAt: new Date(updatedAt) } : {})
    }).where(eq(organization.id, id)).returning();
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  /** Nullable columns become absent fields: the API schema models absence as undefined, not null. */
  private mapToDomain(row: OrganizationRow): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ...(row.description !== null && { description: row.description }),
      ...(row.logo !== null && { logo: row.logo }),
      ...(row.url !== null && { url: row.url }),
      ...(row.colorScheme !== null && { colorScheme: row.colorScheme }),
      ...(row.location !== null && { location: row.location }),
      ...(row.latitude !== null && { latitude: row.latitude }),
      ...(row.longitude !== null && { longitude: row.longitude }),
      shadowBanThreshold: row.shadowBanThreshold,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
