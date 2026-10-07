import type { AppIO, OrganizationRepository } from './index.ts';
import type { Organization } from '../types/organization.ts';
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

export function createInMemoryIO(): AppIO {
  return {
    orgRepo: new InMemoryOrganizationRepository(),
  };
}
