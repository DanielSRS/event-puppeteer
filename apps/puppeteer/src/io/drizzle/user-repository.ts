import { eq, ilike, and, isNull } from 'drizzle-orm';
import type { UserRepository } from '../index.ts';
import type { User, UserUpdate } from '../../types/user.ts';
import { organizationOf } from '../../types/user.ts';
import { user } from '../../db/schema.ts';
import type { Database } from '../../db/index.ts';

type UserRow = typeof user.$inferSelect;

/**
 * Users stored in the `user` table (shared with better-auth). Removed Users
 * (`removedAt` set) are treated as absent, except by `getByEmail`.
 */
export class DrizzleUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async create(u: User): Promise<User> {
    const existing = await this.db.select().from(user).where(eq(user.id, u.id));
    const pgUser = {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      normalizedName: u.normalizedName,
      email: u.email,
      organizationId: organizationOf(u) ?? null,
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
    const rows = await this.db.select().from(user).where(and(eq(user.id, id), isNull(user.removedAt)));
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(user).where(eq(user.email, email));
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async listByOrganization(orgId: string): Promise<User[]> {
    const rows = await this.db.select().from(user).where(and(eq(user.organizationId, orgId), isNull(user.removedAt)));
    return rows.map(r => this.mapToDomain(r));
  }

  /**
   * Changing the role to Superadmin also drops the Organization (a Superadmin has none,
   * as the user_role_organization check enforces). Does not skip removed Users.
   */
  async update(id: string, updates: UserUpdate): Promise<User | null> {
    const { firstName, lastName } = updates;
    const rows = await this.db.update(user)
      .set({
        ...updates,
        ...(updates.role === 'Superadmin' ? { organizationId: null } : {}),
        ...(firstName && lastName ? { name: `${firstName} ${lastName}` } : {})
      })
      .where(eq(user.id, id))
      .returning();
    const row = rows[0];
    return row ? this.mapToDomain(row) : null;
  }

  async searchByName(orgId: string, query: string): Promise<User[]> {
    const searchPattern = `%${query}%`;
    const rows = await this.db.select().from(user).where(
      and(
        eq(user.organizationId, orgId),
        ilike(user.normalizedName, searchPattern),
        isNull(user.removedAt)
      )
    );
    return rows.map(r => this.mapToDomain(r));
  }

  async markRemoved(id: string, removedAt: Date): Promise<boolean> {
    const rows = await this.db.update(user)
      .set({ removedAt, updatedAt: removedAt })
      .where(and(eq(user.id, id), isNull(user.removedAt)))
      .returning({ id: user.id });
    return rows.length > 0;
  }

  /**
   * Converts a row to the domain User, discriminated by role.
   * @throws when the row breaks the role/Organization invariant the database enforces.
   */
  private mapToDomain(row: UserRow): User {
    const fields = {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      normalizedName: row.normalizedName,
      email: row.email,
      isShadowBanned: row.isShadowBanned
    };
    if (row.role === 'Superadmin') return { ...fields, role: 'Superadmin' };
    if (row.role !== 'Admin' && row.role !== 'Moderator' && row.role !== 'Member') {
      throw new Error(`User ${row.id} has an unknown role: ${row.role}`);
    }
    if (row.organizationId === null) {
      throw new Error(`User ${row.id} with role ${row.role} has no Organization`);
    }
    return { ...fields, role: row.role, organizationId: row.organizationId };
  }
}
