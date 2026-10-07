import { eq, ilike, and } from 'drizzle-orm';
import type { UserRepository } from '../index.ts';
import type { User } from '../../types/user.ts';
import { user } from '../../db/schema.ts';

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: any) {}

  async create(u: User): Promise<User> {
    const existing = await this.db.select().from(user).where(eq(user.id, u.id));
    const pgUser = {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      normalizedName: u.normalizedName,
      email: u.email,
      organizationId: u.organizationId,
      role: u.role,
      isShadowBanned: u.isShadowBanned,
      name: `${u.firstName} ${u.lastName}`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existing.length > 0) {
      await this.db.update(user).set(pgUser).where(eq(user.id, u.id));
    } else {
      await this.db.insert(user).values(pgUser);
    }
    return u;
  }

  async getById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(user).where(eq(user.id, id));
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async getByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(user).where(eq(user.email, email));
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByOrganization(orgId: string): Promise<User[]> {
    const rows = await this.db.select().from(user).where(eq(user.organizationId, orgId));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const pgUpdates: any = { ...updates };
    if (updates.firstName && updates.lastName) {
      pgUpdates.name = `${updates.firstName} ${updates.lastName}`;
    }
    const rows = await this.db.update(user).set(pgUpdates).where(eq(user.id, id)).returning();
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async searchByName(orgId: string, query: string): Promise<User[]> {
    const searchPattern = `%${query}%`;
    const rows = await this.db.select().from(user).where(
      and(
        eq(user.organizationId, orgId),
        ilike(user.normalizedName, searchPattern)
      )
    );
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(user).where(eq(user.id, id)).returning({ id: user.id });
    return rows.length > 0;
  }

  private mapToDomain(row: any): User {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      normalizedName: row.normalizedName,
      email: row.email,
      organizationId: row.organizationId,
      role: row.role as User['role'],
      isShadowBanned: row.isShadowBanned,
    };
  }
}
