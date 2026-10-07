import { eq, and } from 'drizzle-orm';
import type { ReportRepository } from '../index.ts';
import type { Report } from '../../types/moderation.ts';
import { report } from '../../db/schema.ts';
import { randomUUID } from 'node:crypto';
import { withoutNulls } from './without-nulls.ts';

export class DrizzleReportRepository implements ReportRepository {
  constructor(private db: any) {}

  async create(r: Report): Promise<Report> {
    const id = r.id || randomUUID();
    const newReport = { ...r, id };
    await this.db.insert(report).values({
      ...newReport,
      createdAt: new Date(newReport.createdAt)
    });
    return newReport;
  }

  async listByEvent(eventId: string): Promise<Report[]> {
    const rows = await this.db.select().from(report).where(eq(report.eventId, eventId));
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async listByOrganization(orgId: string): Promise<Report[]> {
    const { event } = await import('../../db/schema.ts');
    const rows = await this.db.select({
      id: report.id,
      reporterId: report.reporterId,
      eventId: report.eventId,
      reason: report.reason,
      comment: report.comment,
      createdAt: report.createdAt
    }).from(report).innerJoin(event, eq(report.eventId, event.id)).where(eq(event.organizationId, orgId));
    
    return rows.map((r: any) => this.mapToDomain(r));
  }

  async countUniqueReportersByEvent(eventId: string): Promise<number> {
    const rows = await this.db.select({ reporterId: report.reporterId }).from(report).where(eq(report.eventId, eventId));
    const unique = new Set(rows.map((r: any) => r.reporterId));
    return unique.size;
  }

  async existsByUserAndEvent(userId: string, eventId: string): Promise<boolean> {
    const rows = await this.db.select().from(report).where(and(eq(report.reporterId, userId), eq(report.eventId, eventId)));
    return rows.length > 0;
  }

  private mapToDomain(row: any): Report {
    return {
      ...withoutNulls(row),
      createdAt: row.createdAt.toISOString()
    };
  }
}
