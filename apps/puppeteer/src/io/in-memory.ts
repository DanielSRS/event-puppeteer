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
import { DrizzleImageRepository } from './drizzle/image-repository.ts';
import { DrizzleScreeningPolicyRepository } from './drizzle/screening-policy-repository.ts';
import { InMemoryImageScreener } from './screening/in-memory.ts';
import { InMemoryImageStore } from './image-store/in-memory.ts';
import { InMemoryUpdateBinaryStore } from './update-binary-store/in-memory.ts';
import type { AppIO } from './index.ts';

/** The IO tests run on, with the test doubles exposed so tests can drive and inspect them. */
export type InMemoryIO = AppIO & {
  emailSender: InMemoryEmailSender;
  imageScreener: InMemoryImageScreener;
  imageStore: InMemoryImageStore;
  updateBinaryStore: InMemoryUpdateBinaryStore;
};

export async function createInMemoryIO(): Promise<InMemoryIO> {
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
    imageRepo: new DrizzleImageRepository(db),
    screeningPolicyRepo: new DrizzleScreeningPolicyRepository(db),
    auth: new BetterAuthProvider(createAuth({ db, emailSender, apiUrl: 'http://localhost:8080', appUrl: 'http://localhost:3000' })),
    emailSender,
    imageScreener: new InMemoryImageScreener(),
    imageStore: new InMemoryImageStore(),
    updateBinaryStore: new InMemoryUpdateBinaryStore()
  };
}
