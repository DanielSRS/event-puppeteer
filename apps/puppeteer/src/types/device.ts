import { t, type Static } from 'elysia';

export const DeviceStatusSchema = t.Union([
  t.Literal('pending'),
  t.Literal('active'),
  t.Literal('offline'),
  t.Literal('rejected')
]);
export type DeviceStatus = Static<typeof DeviceStatusSchema>;

export const DeviceSchema = t.Object({
  id: t.String(),
  identifier: t.Optional(t.String()),
  name: t.Optional(t.String()),
  location: t.Optional(t.String()),
  organizationId: t.Optional(t.String()),
  status: DeviceStatusSchema,
  connectedAt: t.String({ format: 'date-time' }),
  approvedAt: t.Optional(t.String({ format: 'date-time' })),
  approvedBy: t.Optional(t.String()),
  tokenHash: t.String()
});
export type Device = Static<typeof DeviceSchema>;

// What the API exposes: the token hash never leaves the server
export const PublicDeviceSchema = t.Omit(DeviceSchema, ['tokenHash']);

export const ConnectDeviceBody = t.Object({
  identifier: t.String(),
  organizationId: t.Optional(t.String())
});
export type ConnectDeviceInput = Static<typeof ConnectDeviceBody>;

export const ApproveDeviceBody = t.Object({
  name: t.String(),
  location: t.String(),
  organizationId: t.Optional(t.String())
});
export type ApproveDeviceInput = Static<typeof ApproveDeviceBody>;
