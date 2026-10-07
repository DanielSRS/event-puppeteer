import { t, type Static } from 'elysia';

export const HeartbeatSchema = t.Object({
  deviceId: t.String(),
  timestamp: t.String({ format: 'date-time' }),
  status: t.String(),
  errors: t.Optional(t.Array(t.String()))
});
export type Heartbeat = Static<typeof HeartbeatSchema>;

export const DeviceTelemetrySchema = t.Object({
  cpuTemp: t.Optional(t.Number()),
  memoryUsage: t.Optional(t.Number()),
  diskTotal: t.Optional(t.Number()),
  diskUsage: t.Optional(t.Number()),
  osVersion: t.Optional(t.String()),
  kernelVersion: t.Optional(t.String()),
  puppetVersion: t.Optional(t.String()),
  screenResolution: t.Optional(t.String()),
  hdmiConnected: t.Optional(t.Boolean()),
  screenOn: t.Optional(t.Boolean()),
  hdmiProtocol: t.Optional(t.String()),
  puppetMemoryUsage: t.Optional(t.Number()),
  puppetCpuUsage: t.Optional(t.Number()),
  uptime: t.Optional(t.Number()),
  networkInfo: t.Optional(t.String()),
  connectedNetwork: t.Optional(t.String()),
  osUsers: t.Optional(t.String()),
  userPermissions: t.Optional(t.String()),
  kiosKModeEnabled: t.Optional(t.Boolean()),
  autoLoginEnabled: t.Optional(t.Boolean()),
  startupAppConfigured: t.Optional(t.Boolean()),
  puppetRunLevel: t.Optional(t.String()),
  puppetStartTime: t.Optional(t.String()),
  connectionHistory: t.Optional(t.Array(t.String())),
  suspendEvents: t.Optional(t.Array(t.String())),
  shutdownTimes: t.Optional(t.Array(t.String())),
  startupTimes: t.Optional(t.Array(t.String())),
  restarts: t.Optional(t.Number()),
  crashes: t.Optional(t.Number()),
  hdmiDisconnects: t.Optional(t.Number()),
  screenPowerChanges: t.Optional(t.Number())
});
export type DeviceTelemetry = Static<typeof DeviceTelemetrySchema>;

export const DeviceLogSchema = t.Object({
  id: t.String(),
  deviceId: t.String(),
  level: t.String(),
  message: t.String(),
  timestamp: t.String({ format: 'date-time' })
});
export type DeviceLog = Static<typeof DeviceLogSchema>;

export const PostLogBody = t.Object({
  level: t.String(),
  message: t.String()
});
export type PostLogInput = Static<typeof PostLogBody>;
