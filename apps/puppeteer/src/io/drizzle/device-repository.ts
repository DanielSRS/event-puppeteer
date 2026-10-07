import { eq, isNull } from 'drizzle-orm';
import type { DeviceRepository } from '../index.ts';
import type { Device } from '../../types/device.ts';
import { device } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleDeviceRepository implements DeviceRepository {
  constructor(private db: any) {}

  async create(d: Omit<Device, 'id'>): Promise<Device> {
    const id = randomUUID();
    const newDevice = { ...d, id };
    await this.db.insert(device).values({
      ...newDevice,
      connectedAt: new Date(newDevice.connectedAt),
      approvedAt: newDevice.approvedAt ? new Date(newDevice.approvedAt) : null
    });
    return newDevice;
  }

  async getById(id: string): Promise<Device | null> {
    const rows = await this.db.select().from(device).where(eq(device.id, id));
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async getByTokenHash(hash: string): Promise<Device | null> {
    const rows = await this.db.select().from(device).where(eq(device.tokenHash, hash));
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByOrganization(orgId: string): Promise<Device[]> {
    const rows = await this.db.select().from(device).where(eq(device.organizationId, orgId));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async listPending(): Promise<Device[]> {
    const rows = await this.db.select().from(device).where(eq(device.status, 'pending'));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async listPendingWithoutOrg(): Promise<Device[]> {
    const rows = await this.db.select().from(device).where(isNull(device.organizationId));
    // And status pending
    return rows.filter((r: any) => r.status === 'pending').map((r: any) => this.mapToDomain(r));
  }

  async listPendingByOrg(orgId: string): Promise<Device[]> {
    const rows = await this.db.select().from(device).where(eq(device.organizationId, orgId));
    return rows.filter((r: any) => r.status === 'pending').map((r: any) => this.mapToDomain(r));
  }

  async update(id: string, updates: Partial<Device>): Promise<Device | null> {
    const pgUpdates: any = { ...updates };
    if (updates.connectedAt) pgUpdates.connectedAt = new Date(updates.connectedAt);
    if (updates.approvedAt) pgUpdates.approvedAt = new Date(updates.approvedAt);

    const rows = await this.db.update(device).set(pgUpdates).where(eq(device.id, id)).returning();
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  private mapToDomain(row: any): Device {
    return {
      ...row,
      connectedAt: row.connectedAt.toISOString(),
      approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
      approvedBy: row.approvedBy || undefined,
      name: row.name || undefined,
      location: row.location || undefined,
      organizationId: row.organizationId || undefined
    };
  }
}
