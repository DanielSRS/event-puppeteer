import type { Organization } from '../types/organization.ts';

export interface OrganizationRepository {
  create(org: Omit<Organization, 'id'>): Promise<Organization>;
  getById(id: string): Promise<Organization | null>;
  getAll(): Promise<Organization[]>;
  update(id: string, updates: Partial<Omit<Organization, 'id'>>): Promise<Organization | null>;
}

export interface AppIO {
  orgRepo: OrganizationRepository;
}

export function createRealIO(): AppIO {
  // In the future, this will initialize database connections and external services
  throw new Error("Real IO not implemented yet");
}
