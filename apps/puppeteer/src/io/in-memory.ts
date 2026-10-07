import type { AppIO, OrganizationRepository, UserRepository, AuthProvider, AuthSession } from './index.ts';
import type { Organization } from '../types/organization.ts';
import type { User } from '../types/user.ts';
import { randomUUID } from 'node:crypto';

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

  async create(org: Omit<Organization, 'id'>): Promise<Organization> {
    const id = randomUUID();
    const newOrg: Organization = { id, ...org };
    this.organizations.set(id, newOrg);
    return newOrg;
  }

  async getById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) ?? null;
  }

  async getAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null> {
    const existing = this.organizations.get(id);
    if (!existing) return null;

    const updated: Organization = { ...existing, ...updates };
    this.organizations.set(id, updated);
    return updated;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async getById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async listByOrganization(orgId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.organizationId === orgId);
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async searchByName(orgId: string, query: string): Promise<User[]> {
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return Array.from(this.users.values()).filter(u => 
      u.organizationId === orgId && u.normalizedName.includes(normalizedQuery)
    );
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}

export class InMemoryAuthProvider implements AuthProvider {
  // Simple in-memory mock for tests since we can't easily run real betterAuth isolated in-memory for pure unit tests
  private users: Map<string, { email: string, pass: string, name: string }> = new Map();
  private sessions: Map<string, string> = new Map(); // token -> userId

  async signUp(email: string, password: string, name: string): Promise<AuthSession> {
    if (Array.from(this.users.values()).find(u => u.email === email)) {
      throw new Error('Email already exists');
    }
    const userId = randomUUID();
    this.users.set(userId, { email, pass: password, name });
    const token = randomUUID();
    this.sessions.set(token, userId);
    return { token, userId };
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    for (const [userId, u] of this.users.entries()) {
      if (u.email === email && u.pass === password) {
        const token = randomUUID();
        this.sessions.set(token, userId);
        return { token, userId };
      }
    }
    throw new Error('Invalid credentials');
  }

  async getSessionUserId(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    return this.sessions.get(token) ?? null;
  }
}

export function createInMemoryIO(): AppIO {
  return {
    orgRepo: new InMemoryOrganizationRepository(),
    userRepo: new InMemoryUserRepository(),
    auth: new InMemoryAuthProvider()
  };
}
