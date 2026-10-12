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
  t.Literal('update_org_threshold'),
  t.Literal('remove_user'),
  t.Literal('change_role'),
  t.Literal('approve_image'),
  t.Literal('reject_image'),
  t.Literal('update_screening_policy')
]);
export type AuditAction = Static<typeof AuditActionSchema>;

export const AuditEntrySchema = t.Object({
  id: t.String(),
  actorId: t.Optional(t.String()), // absent for automatic actions (e.g. report threshold)
  organizationId: t.Optional(t.String()),
  action: AuditActionSchema,
  /** 'event', 'user', 'tag', 'organization', 'image' or 'screening_policy'. */
  targetType: t.String(),
  targetId: t.String(),
  details: t.Optional(t.Record(t.String(), t.Any())),
  createdAt: t.String({ format: 'date-time' })
});
export type AuditEntry = Static<typeof AuditEntrySchema>;
