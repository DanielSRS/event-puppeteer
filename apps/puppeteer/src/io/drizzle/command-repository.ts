import { eq, desc } from 'drizzle-orm';
import type { CommandRepository } from '../index.ts';
import type { Command } from '../../types/command.ts';
import { command } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';
import { withoutNulls } from './without-nulls.ts';

export class DrizzleCommandRepository implements CommandRepository {
  constructor(private db: any) {}

  async create(cmd: Command): Promise<Command> {
    const id = cmd.id || randomUUID();
    const newCommand = { ...cmd, id };
    await this.db.insert(command).values({
      ...newCommand,
      issuedAt: new Date(newCommand.issuedAt),
      completedAt: newCommand.completedAt ? new Date(newCommand.completedAt) : null
    });
    return newCommand;
  }

  async getById(id: string): Promise<Command | null> {
    const rows = await this.db.select().from(command).where(eq(command.id, id));
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByDevice(deviceId: string): Promise<Command[]> {
    const rows = await this.db.select().from(command).where(eq(command.deviceId, deviceId)).orderBy(desc(command.issuedAt));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async updateStatus(id: string, status: Command['status']): Promise<Command | null> {
    const updates: any = { status };
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }
    const rows = await this.db.update(command).set(updates).where(eq(command.id, id)).returning();
    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  private mapToDomain(row: any): Command {
    return {
      ...withoutNulls(row),
      issuedAt: row.issuedAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : undefined
    };
  }
}
