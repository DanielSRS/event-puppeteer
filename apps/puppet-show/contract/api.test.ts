/**
 * The contract between puppet-show and Puppeteer, checked against Puppeteer's
 * own schemas.
 *
 * `./schemas` is a hand-kept copy of the API's TypeBox schemas (issue #15
 * would generate it instead). A copy drifts in two ways that break pages:
 * - a closed set (enum) the API grew: zod refuses the new value, and the whole
 *   answer with it (how the audit page broke when Image actions were added);
 * - a field the copy requires that the API doesn't always send.
 * New fields the copy doesn't know are harmless (zod drops them), so they are
 * not checked.
 *
 * Puppeteer's schemas are TypeBox, i.e. JSON Schema objects, read here as
 * plain data. Importing them needs Puppeteer's dependencies (elysia), which
 * the app's build doesn't install, so this folder is left out of the app's
 * tsconfig and has its own (like `e2e/`).
 *
 * @module
 */

import { describe, expect, test } from "vitest";
import type { z } from "zod";
import * as Front from "@/lib/api/schemas";
import * as ApiUser from "../../puppeteer/src/types/user.ts";
import * as ApiModeration from "../../puppeteer/src/types/moderation.ts";
import * as ApiDevice from "../../puppeteer/src/types/device.ts";
import * as ApiCommand from "../../puppeteer/src/types/command.ts";
import * as ApiImage from "../../puppeteer/src/types/image.ts";
import * as ApiEvent from "../../puppeteer/src/types/event.ts";
import * as ApiOrganization from "../../puppeteer/src/types/organization.ts";

/** Whether `value` is a plain object (a JSON Schema node). */
function IsNode(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The values of a TypeBox union of literals (`{ anyOf: [{ const }] }`), sorted. */
function LiteralValues(schema: unknown): string[] {
  if (!IsNode(schema) || !Array.isArray(schema.anyOf)) return [];
  return schema.anyOf.map((member) => (IsNode(member) ? String(member.const) : "")).sort();
}

/** The fields a TypeBox object always sends (`required`), sorted. */
function RequiredFields(schema: unknown): string[] {
  if (!IsNode(schema) || !Array.isArray(schema.required)) return [];
  return schema.required.map(String).sort();
}

/** The fields a zod object of the copy requires. */
function FrontRequired(schema: z.ZodObject): string[] {
  return Object.entries(schema.shape).filter(([, field]) => !field.safeParse(undefined).success).map(([name]) => name).sort();
}

/** The fields the copy requires but the API doesn't always send (should be none). */
function MissingFromApi(front: z.ZodObject, api: unknown): string[] {
  const sent = new Set(RequiredFields(api));
  return FrontRequired(front).filter((field) => !sent.has(field));
}

describe("closed sets are the same on both sides", () => {
  const sets: Array<[string, readonly string[], unknown]> = [
    ["user roles", Front.UserRoleSchema.options, ApiUser.UserRoleSchema],
    ["organization roles", Front.OrgRoleSchema.options, ApiUser.OrgRoleSchema],
    ["report reasons", Front.ReportReasonSchema.options, ApiModeration.ReportReasonSchema],
    ["audit actions", Front.AuditActionSchema.options, ApiModeration.AuditActionSchema],
    ["device statuses", Front.DeviceStatusValueSchema.options, ApiDevice.DeviceStatusSchema],
    ["command types", Front.CommandTypeSchema.options, ApiCommand.CommandTypeSchema],
    ["command statuses", Front.CommandStatusSchema.options, ApiCommand.CommandStatusSchema],
    ["Image kinds", Front.ImageReviewItemSchema.shape.kind.options, ApiImage.ImageKindSchema],
  ];

  test.each(sets)("%s", (_name, front, api) => {
    const apiValues = LiteralValues(api);
    expect(apiValues.length).toBeGreaterThan(0);
    expect([...front].sort()).toEqual(apiValues);
  });

  test("Screening categories", () => {
    expect([...Front.SCREENING_CATEGORIES].sort()).toEqual([...ApiImage.SCREENING_CATEGORIES].sort());
  });
});

describe("every field the copy requires is always sent by the API", () => {
  const objects: Array<[string, z.ZodObject, unknown]> = [
    ["Organization", Front.OrganizationSchema, ApiOrganization.OrganizationViewSchema],
    ["Event (lists)", Front.EventSchema, ApiEvent.EventViewSchema],
    ["Event with votes", Front.EventWithVotesSchema, ApiEvent.EventWithVotesSchema],
    ["Feed event", Front.FeedEventSchema, ApiEvent.FeedEventSchema],
    ["Image view", Front.ImageViewSchema, ApiImage.ImageViewSchema],
    ["Image Review item", Front.ImageReviewItemSchema, ApiImage.ImageReviewItemSchema],
    ["Report", Front.ReportSchema, ApiModeration.ReportSchema],
    ["Audit entry", Front.AuditEntrySchema, ApiModeration.AuditEntrySchema],
    ["Device", Front.DeviceSchema, ApiDevice.PublicDeviceSchema],
    ["Command", Front.CommandSchema, ApiCommand.CommandSchema],
  ];

  test.each(objects)("%s", (_name, front, api) => {
    expect(RequiredFields(api).length).toBeGreaterThan(0);
    expect(MissingFromApi(front, api)).toEqual([]);
  });
});
