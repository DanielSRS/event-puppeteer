import { eq, desc } from 'drizzle-orm';
import type { TelemetryRepository } from '../index.ts';
import type { Heartbeat, DeviceLog, DeviceTelemetry } from '../../types/telemetry.ts';
import { telemetryHeartbeat, telemetryLog, telemetryData } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';

export class DrizzleTelemetryRepository implements TelemetryRepository {
  constructor(private db: any) {}

  async recordHeartbeat(heartbeat: Heartbeat): Promise<void> {
    await this.db.insert(telemetryHeartbeat).values({
      ...heartbeat,
      timestamp: new Date(heartbeat.timestamp)
    });
  }

  async recordLog(log: DeviceLog): Promise<void> {
    const id = log.id || randomUUID();
    await this.db.insert(telemetryLog).values({
      ...log,
      id,
      timestamp: new Date(log.timestamp)
    });
  }

  async getLatestHeartbeat(deviceId: string): Promise<Heartbeat | null> {
    const rows = await this.db.select().from(telemetryHeartbeat)
      .where(eq(telemetryHeartbeat.deviceId, deviceId))
      .orderBy(desc(telemetryHeartbeat.timestamp))
      .limit(1);
    if (rows.length === 0) return null;
    return this.mapHeartbeat(rows[0]);
  }

  async getHeartbeatHistory(deviceId: string): Promise<Heartbeat[]> {
    const rows = await this.db.select().from(telemetryHeartbeat)
      .where(eq(telemetryHeartbeat.deviceId, deviceId))
      .orderBy(desc(telemetryHeartbeat.timestamp))
      .limit(100);
    return rows.map((r: any) => this.mapHeartbeat(r));
  }

  async getDeviceLogs(deviceId: string): Promise<DeviceLog[]> {
    const rows = await this.db.select().from(telemetryLog)
      .where(eq(telemetryLog.deviceId, deviceId))
      .orderBy(desc(telemetryLog.timestamp))
      .limit(100);
    return rows.map((r: any) => ({
      ...r,
      timestamp: r.timestamp.toISOString()
    }));
  }

  async saveDetailedTelemetry(deviceId: string, telemetry: DeviceTelemetry): Promise<void> {
    // we use an upsert strategy using onConflictDoUpdate since deviceId is PK
    await this.db.insert(telemetryData).values({
      deviceId,
      data: telemetry
    }).onConflictDoUpdate({
      target: telemetryData.deviceId,
      set: { data: telemetry }
    });
  }

  async getLatestTelemetry(deviceId: string): Promise<DeviceTelemetry | null> {
    const rows = await this.db.select().from(telemetryData).where(eq(telemetryData.deviceId, deviceId));
    if (rows.length === 0) return null;
    return rows[0].data as DeviceTelemetry;
  }

  private mapHeartbeat(row: any): Heartbeat {
    return {
      deviceId: row.deviceId,
      timestamp: row.timestamp.toISOString(),
      status: row.status,
      errors: row.errors || undefined
    };
  }
}
