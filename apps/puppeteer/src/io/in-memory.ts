import { DrizzleUserRepository } from './drizzle/user-repository.ts';
import { DrizzleOrganizationRepository } from './drizzle/organization-repository.ts';
import { DrizzleTagRepository } from './drizzle/tag-repository.ts';
import { DrizzleLinkLabelRepository } from './drizzle/link-label-repository.ts';
import { DrizzleEventRepository } from './drizzle/event-repository.ts';
import { DrizzleVoteRepository } from './drizzle/vote-repository.ts';
import { DrizzleReportRepository } from './drizzle/report-repository.ts';
import { DrizzleAuditRepository } from './drizzle/audit-repository.ts';
import { DrizzleDeviceRepository } from './drizzle/device-repository.ts';
import { DrizzleTelemetryRepository } from './drizzle/telemetry-repository.ts';
import { DrizzleCommandRepository } from './drizzle/command-repository.ts';
import { BetterAuthProvider } from './better-auth-adapter.ts';
import { createInMemoryDatabase } from '../db/index.ts';
import { createAuth } from "../auth.ts";
import { InMemoryEmailSender } from "./email/in-memory.ts";
import type { AppIO } from './index.ts';

export async function createInMemoryIO(): Promise<AppIO & { emailSender: InMemoryEmailSender }> {
  const db = await createInMemoryDatabase();
  const emailSender = new InMemoryEmailSender();
  return {
    orgRepo: new DrizzleOrganizationRepository(db),
    userRepo: new DrizzleUserRepository(db),
    tagRepo: new DrizzleTagRepository(db),
    linkLabelRepo: new DrizzleLinkLabelRepository(db),
    eventRepo: new DrizzleEventRepository(db),
    voteRepo: new DrizzleVoteRepository(db),
    reportRepo: new DrizzleReportRepository(db),
    auditRepo: new DrizzleAuditRepository(db),
    deviceRepo: new DrizzleDeviceRepository(db),
    telemetryRepo: new DrizzleTelemetryRepository(db),
    commandRepo: new DrizzleCommandRepository(db),
    auth: new BetterAuthProvider(createAuth({ db, emailSender, apiUrl: 'http://localhost:8080', appUrl: 'http://localhost:3000' })),
    emailSender
  };
}
