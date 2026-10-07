import { t, type Static } from 'elysia';

export const ReportReasonSchema = t.Union([
  t.Literal('spam'),
  t.Literal('offensive_content'),
  t.Literal('incorrect_information'),
  t.Literal('duplicate')
]);
export type ReportReason = Static<typeof ReportReasonSchema>;

export const ReportSchema = t.Object({
  id: t.String(),
  reporterId: t.String(),
  eventId: t.String(),
  reason: ReportReasonSchema,
  comment: t.Optional(t.String()),
  createdAt: t.String({ format: 'date-time' })
});
export type Report = Static<typeof ReportSchema>;

export const CreateReportBody = t.Object({
  reason: ReportReasonSchema,
  comment: t.Optional(t.String())
});
export type CreateReportInput = Static<typeof CreateReportBody>;

export const AuditActionSchema = t.Union([
  t.Literal('hide_event'),
  t.Literal('unhide_event'),
  t.Literal('apply_shadow_ban'),
  t.Literal('lift_shadow_ban'),
  t.Literal('promote_tag'),
  t.Literal('update_org_threshold')
]);
export type AuditAction = Static<typeof AuditActionSchema>;

export const AuditEntrySchema = t.Object({
  id: t.String(),
  actorId: t.Optional(t.String()), // absent for automatic actions (e.g. report threshold)
  organizationId: t.Optional(t.String()),
  action: AuditActionSchema,
  targetType: t.String(), // 'event', 'user', 'tag', 'organization'
  targetId: t.String(),
  details: t.Optional(t.Record(t.String(), t.Any())),
  createdAt: t.String({ format: 'date-time' })
});
export type AuditEntry = Static<typeof AuditEntrySchema>;
