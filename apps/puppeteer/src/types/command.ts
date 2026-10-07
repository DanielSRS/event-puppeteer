import { t, type Static } from 'elysia';

export const CommandTypeSchema = t.Union([
  t.Literal('restart'),
  t.Literal('shutdown'),
  t.Literal('update'),
  t.Literal('open_ssh'),
  t.Literal('custom'),
  t.Literal('request_telemetry')
]);
export type CommandType = Static<typeof CommandTypeSchema>;

export const CommandStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('sent'),
  t.Literal('acknowledged'),
  t.Literal('completed'),
  t.Literal('failed')
]);
export type CommandStatus = Static<typeof CommandStatusSchema>;

export const CommandSchema = t.Object({
  id: t.String(),
  deviceId: t.String(),
  type: CommandTypeSchema,
  payload: t.Optional(t.Record(t.String(), t.Unknown())),
  status: CommandStatusSchema,
  issuedBy: t.String(),
  issuedAt: t.String({ format: 'date-time' }),
  completedAt: t.Optional(t.String({ format: 'date-time' }))
});
export type Command = Static<typeof CommandSchema>;

// Contract implemented by Puppet: download, verify digest and architecture, install, re-exec
export const UpdatePayloadSchema = t.Object({
  url: t.String({
    pattern: '^(https?://|/)',
    description: 'Absolute http(s) URL, or a path on Puppeteer starting with "/" (only then does Puppet send its device token)'
  }),
  sha256: t.String({ pattern: '^[0-9a-fA-F]{64}$', description: 'SHA-256 of the binary, 64 hex characters' }),
  version: t.Optional(t.String({ description: 'Informational; shows up in device logs' }))
});
export type UpdatePayload = Static<typeof UpdatePayloadSchema>;

export const CreateCommandBody = t.Union([
  t.Object({ type: t.Literal('update'), payload: UpdatePayloadSchema }),
  t.Object({
    type: t.Union([
      t.Literal('restart'),
      t.Literal('shutdown'),
      t.Literal('open_ssh'),
      t.Literal('custom'),
      t.Literal('request_telemetry')
    ]),
    payload: t.Optional(t.Record(t.String(), t.Unknown()))
  })
]);
export type CreateCommandInput = Static<typeof CreateCommandBody>;
