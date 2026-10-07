import { eq } from 'drizzle-orm';
import type { OrganizationRepository } from '../index.ts';
import type { Organization } from '../../types/organization.ts';
import { organization } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(private db: any) {}

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
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async getAll(): Promise<Organization[]> {
    const rows = await this.db.select().from(organization);
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null> {
    // If updates has date strings, we might need to convert them to Dates if we update them.
    // In our types, updates doesn't usually include createdAt. 
    // We can just cast dates if they exist.
    const pgUpdates: any = { ...updates };
    if (updates.updatedAt) pgUpdates.updatedAt = new Date(updates.updatedAt);
    if (updates.createdAt) pgUpdates.createdAt = new Date(updates.createdAt);

    const rows = await this.db.update(organization).set(pgUpdates).where(eq(organization.id, id)).returning();
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  private mapToDomain(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ...(row.description != null && { description: row.description }),
      ...(row.logo != null && { logo: row.logo }),
      ...(row.url != null && { url: row.url }),
      ...(row.colorScheme != null && { colorScheme: row.colorScheme }),
      ...(row.location != null && { location: row.location }),
      ...(row.latitude != null && { latitude: row.latitude }),
      ...(row.longitude != null && { longitude: row.longitude }),
      shadowBanThreshold: row.shadowBanThreshold,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt
    };
  }
}
