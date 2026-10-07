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

export const CreateCommandBody = t.Object({
  type: CommandTypeSchema,
  payload: t.Optional(t.Record(t.String(), t.Unknown()))
});
export type CreateCommandInput = Static<typeof CreateCommandBody>;
