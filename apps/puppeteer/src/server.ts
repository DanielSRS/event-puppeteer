import { Elysia, t, type ElysiaAdapter } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import type { AppIO } from './io/index.ts';
import { healthCheck } from './handlers/health.ts';
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler
} from './handlers/organization.ts';
import {
  CreateOrganizationBody,
  UpdateOrganizationBody,
  OrganizationSchema
} from './types/organization.ts';
import { UserSchema, RegisterBody, LoginBody, ChangeRoleBody } from './types/user.ts';
import { registerHandler, loginHandler, meHandler } from './handlers/auth.ts';
import { listOrgUsersHandler, assignRoleHandler, removeUserHandler } from './handlers/users.ts';
import { TagSchema, CreateTagBody, LinkLabelSchema, CreateLinkLabelBody } from './types/tag.ts';
import { EventSchema, CreateEventBody, FeedEventSchema } from './types/event.ts';
import { connectDeviceHandler, getCurrentDeviceHandler, listPendingDevicesGlobalHandler, listPendingDevicesOrgHandler, listActiveDevicesOrgHandler, getDeviceHandler, approveDeviceHandler, rejectDeviceHandler } from './handlers/devices.ts';
import { PublicDeviceSchema, ConnectDeviceBody, ApproveDeviceBody } from './types/device.ts';
import { heartbeatHandler, postLogHandler, postTelemetryHandler, pullPendingCommandsHandler, ackCommandHandler, completeCommandHandler, getDeviceStatusHandler, getDeviceLogsHandler, getDetailedTelemetryHandler, sendCommandHandler, requestTelemetryHandler, listCommandsHandler } from './handlers/telemetry.ts';
import { PostLogBody, DeviceTelemetrySchema, DeviceLogSchema, HeartbeatSchema } from './types/telemetry.ts';
import { CreateCommandBody, CommandSchema } from './types/command.ts';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './handlers/system.ts';
import { createEventHandler, listEventsHandler, getEventHandler, deleteEventHandler } from './handlers/events.ts';
import { voteHandler, getVoteStatusHandler } from './handlers/votes.ts';
import { eventFeedHandler } from './handlers/feed.ts';
import { ReportSchema, CreateReportBody, AuditEntrySchema } from './types/moderation.ts';
import { reportEventHandler, listReportsHandler, hideEventHandler, unhideEventHandler, listShadowBansHandler, liftShadowBanHandler, promoteTagHandler, listAuditTrailHandler } from './handlers/moderation.ts';

// Security requirements referenced by route docs (schemes declared in the openapi plugin below)
const asUser = [{ userToken: [] }];
const asDevice = [{ deviceToken: [] }];

const docs = openapi({
  documentation: {
    info: {
      title: 'Puppeteer API',
      version: '0.0.1',
      description: 'Central hub for the institutional event display system: organizations, users, events, moderation, and remote management of kiosk Devices running Puppet.'
    },
    tags: [
      { name: 'Health', description: 'Liveness probe' },
      { name: 'Auth', description: 'User registration, login, and session' },
      { name: 'Organizations', description: 'Organization CRUD and public event feed' },
      { name: 'Users', description: 'Organization users and role assignment' },
      { name: 'Events', description: 'Event creation, listing, and soft-delete' },
      { name: 'Votes', description: 'Votes that weight an event in the kiosk rotation' },
      { name: 'Moderation', description: 'Reports, hidden events, shadow bans, tag promotion, and the audit trail' },
      { name: 'Tags', description: 'System-wide Tags and Link Labels' },
      { name: 'Device', description: 'Endpoints called by Puppet from the Device itself (device token)' },
      { name: 'Device Management', description: 'Enrollment, telemetry, and Commands, operated by Admins and Superadmins' }
    ],
    components: {
      securitySchemes: {
        userToken: {
          type: 'http',
          scheme: 'bearer',
          description: 'Session token returned by POST /auth/register or POST /auth/login'
        },
        deviceToken: {
          type: 'http',
          scheme: 'bearer',
          description: 'Device token returned by POST /devices/connect'
        }
      }
    }
  }
});

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
// Adapter defaults to Web Standard (what Vercel runs); local Node passes node()
export function createServer(io: AppIO, adapter?: ElysiaAdapter) {
  return new Elysia(adapter ? { adapter } : {})
    .use(docs)
    // Not .decorate(): Elysia deep-merges decorators into every group, and walking the
    // Drizzle/better-auth instances inside io never terminates (heap OOM at startup)
    .derive({ as: 'global' }, () => ({ io }))
    .onError(({ code, error, set }) => {
      const message = error instanceof Error ? error.message : (error as any).message;
      if (message === 'UNAUTHORIZED') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (message === 'FORBIDDEN') {
        set.status = 403;
        return { error: 'Forbidden' };
      }
      if (message === 'NOT_FOUND' || message === 'USER_NOT_FOUND') {
        set.status = 404;
        return { error: 'Not Found' };
      }
      if (message === 'EMAIL_EXISTS') {
        set.status = 400;
        return { error: 'Email already exists' };
      }
      if (message === 'BAD_REQUEST') {
        set.status = 400;
        return { error: 'Bad Request' };
      }
    })
    .get(
      '/health',
      ({ request, io }) => healthCheck(request, io),
      {
        response: t.Object({
          status: t.Literal('ok')
        }),
        detail: { tags: ['Health'], summary: 'Health check' }
      }
    )

    .group('/devices', (app) =>
      app
        .post('/connect', async ({ body, io }) => {
          return await connectDeviceHandler(body, io);
        }, {
          body: ConnectDeviceBody,
          response: t.Object({ device: PublicDeviceSchema, token: t.String() }),
          detail: {
            tags: ['Device'],
            summary: 'Connect a Device',
            description: 'Enters the pending enrollment queue and returns the device token. Reconnecting with the identifier of a still-pending Device reuses that entry and rotates its token.'
          }
        })
        .get('/me', async ({ request, io }) => {
          return await getCurrentDeviceHandler(request, io);
        }, {
          response: PublicDeviceSchema,
          detail: {
            tags: ['Device'],
            summary: 'Get the calling Device',
            description: 'Answers for pending and rejected Devices too, so Puppet can wait for approval or stop retrying.',
            security: asDevice
          }
        })
        .get('/pending', async ({ request, io }) => {
          return await listPendingDevicesGlobalHandler(request, io);
        }, {
          response: t.Array(PublicDeviceSchema),
          detail: {
            tags: ['Device Management'],
            summary: 'List pending Devices without an Organization',
            description: 'Superadmin only.',
            security: asUser
          }
        })
        .post('/:deviceId/approve', async ({ request, params: { deviceId }, body, io }) => {
          return await approveDeviceHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: ApproveDeviceBody,
          response: PublicDeviceSchema,
          detail: {
            tags: ['Device Management'],
            summary: 'Approve a pending Device',
            description: 'Assigns name, location, and Organization. Superadmin may pick any Organization; an Admin only their own.',
            security: asUser
          }
        })
        .post('/:deviceId/reject', async ({ request, params: { deviceId }, io }) => {
          return await rejectDeviceHandler(request, deviceId, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          response: PublicDeviceSchema,
          detail: { tags: ['Device Management'], summary: 'Reject a pending Device', security: asUser }
        })

        .post('/:deviceId/heartbeat', async ({ request, params: { deviceId }, body, io }) => {
          return await heartbeatHandler(request, deviceId, body.status, body.errors, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: t.Object({ status: t.String(), errors: t.Optional(t.Array(t.String())) }),
          response: t.Object({ success: t.Boolean() }),
          detail: { tags: ['Device'], summary: 'Send a heartbeat', security: asDevice }
        })
        .post('/:deviceId/logs', async ({ request, params: { deviceId }, body, io }) => {
          return await postLogHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: PostLogBody,
          response: t.Object({ success: t.Boolean() }),
          detail: { tags: ['Device'], summary: 'Send a log entry', security: asDevice }
        })
        .post('/:deviceId/telemetry', async ({ request, params: { deviceId }, body, io }) => {
          return await postTelemetryHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: DeviceTelemetrySchema,
          response: t.Object({ success: t.Boolean() }),
          detail: {
            tags: ['Device'],
            summary: 'Send detailed Telemetry',
            description: 'Also completes any outstanding request_telemetry Command.',
            security: asDevice
          }
        })
        .get('/:deviceId/commands/pending', async ({ request, params: { deviceId }, io }) => {
          return await pullPendingCommandsHandler(request, deviceId, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          response: t.Array(CommandSchema),
          detail: {
            tags: ['Device'],
            summary: 'Pull pending Commands',
            description: 'Returns Commands not yet acknowledged, oldest first, marking pending ones as sent. A Command is redelivered on every poll until the Device acknowledges it (at-least-once). Returns an empty list while the Device is not active.',
            security: asDevice
          }
        })
        .post('/:deviceId/commands/:commandId/ack', async ({ request, params: { deviceId, commandId }, io }) => {
          return await ackCommandHandler(request, deviceId, commandId, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          response: CommandSchema,
          detail: { tags: ['Device'], summary: 'Acknowledge a Command', security: asDevice }
        })
        .post('/:deviceId/commands/:commandId/complete', async ({ request, params: { deviceId, commandId }, body, io }) => {
          return await completeCommandHandler(request, deviceId, commandId, body.success, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          body: t.Object({ success: t.Boolean() }),
          response: CommandSchema,
          detail: { tags: ['Device'], summary: 'Report a Command as completed or failed', security: asDevice }
        })
    )
    .group('/tags', (app) =>
      app
        .post('/', async ({ request, body, io }) => createTagHandler(request, body, io), {
          body: CreateTagBody,
          response: TagSchema,
          detail: { tags: ['Tags'], summary: 'Create a Tag', security: asUser }
        })
        .get('/', async ({ io }) => listTagsHandler(io), {
          response: t.Array(TagSchema),
          detail: { tags: ['Tags'], summary: 'List Tags' }
        })
        .post('/:tagId/promote', async ({ request, params: { tagId }, io }) => {
          return await promoteTagHandler(request, tagId, io);
        }, {
          params: t.Object({ tagId: t.String() }),
          response: TagSchema,
          detail: {
            tags: ['Moderation'],
            summary: 'Promote a free-form Tag to the known set',
            security: asUser
          }
        })
    )
    .group('/link-labels', (app) =>
      app
        .post('/', async ({ request, body, io }) => createLinkLabelHandler(request, body, io), {
          body: CreateLinkLabelBody,
          response: LinkLabelSchema,
          detail: { tags: ['Tags'], summary: 'Create a Link Label', security: asUser }
        })
        .get('/', async ({ io }) => listLinkLabelsHandler(io), {
          response: t.Array(LinkLabelSchema),
          detail: { tags: ['Tags'], summary: 'List Link Labels' }
        })
    )
    .group('/auth', (app) =>
      app
        .post(
          '/register',
          async ({ body, query, io }) => {
            const orgId = query.orgId ?? 'default-org';
            return await registerHandler(body, orgId, io);
          },
          {
            body: RegisterBody,
            query: t.Object({ orgId: t.Optional(t.String()) }),
            response: t.Object({
              user: UserSchema,
              token: t.String()
            }),
            detail: { tags: ['Auth'], summary: 'Register a User as Member of an Organization' }
          }
        )
        .post(
          '/login',
          async ({ body, io }) => {
            return await loginHandler(body, io);
          },
          {
            body: LoginBody,
            response: t.Object({
              userId: t.String(),
              token: t.String()
            }),
            detail: { tags: ['Auth'], summary: 'Log in with email and password' }
          }
        )
        .get(
          '/me',
          async ({ request, io }) => {
            return await meHandler(request, io);
          },
          {
            response: UserSchema,
            detail: { tags: ['Auth'], summary: 'Get the logged-in User', security: asUser }
          }
        )
    )
    .group('/organizations', (app) =>
      app
        .post(
          '/',
          async ({ request, body, io }) => {
            return await createOrganizationHandler(request, body, io);
          },
          {
            body: CreateOrganizationBody,
            response: OrganizationSchema,
            detail: { tags: ['Organizations'], summary: 'Create an Organization', description: 'Superadmin only.', security: asUser }
          }
        )
        .get(
          '/',
          async ({ request, io }) => {
            return await listOrganizationsHandler(request, io);
          },
          {
            response: t.Array(OrganizationSchema),
            detail: { tags: ['Organizations'], summary: 'List Organizations', description: 'Superadmin only.', security: asUser }
          }
        )
        .get(
          '/:id',
          async ({ params: { id }, io, set }) => {
            const org = await getOrganizationHandler(id, io);
            if (!org) {
              set.status = 404;
              return { error: 'Not Found' };
            }
            return org;
          },
          {
            params: t.Object({ id: t.String() }),
            response: {
              200: OrganizationSchema,
              404: t.Object({ error: t.String() })
            },
            detail: { tags: ['Organizations'], summary: 'Get an Organization', description: 'Public: the kiosk TV display reads the branding.' }
          }
        )
        .patch(
          '/:id',
          async ({ request, params: { id }, body, io, set }) => {
            const org = await updateOrganizationHandler(request, id, body, io);
            if (!org) {
              set.status = 404;
              return { error: 'Not Found' };
            }
            return org;
          },
          {
            params: t.Object({ id: t.String() }),
            body: UpdateOrganizationBody,
            response: {
              200: OrganizationSchema,
              404: t.Object({ error: t.String() })
            },
            detail: { tags: ['Organizations'], summary: 'Update an Organization', description: 'Admin of the Organization, or Superadmin.', security: asUser }
          }
        )
        .get(
          '/:id/feed',
          async ({ params: { id }, io }) => {
            return await eventFeedHandler(id, io);
          },
          {
            params: t.Object({ id: t.String() }),
            response: t.Array(FeedEventSchema),
            detail: {
              tags: ['Organizations'],
              summary: 'Get the weighted event feed shown on kiosks',
              description: 'Events weighted by Votes and temporal relevance. Hidden events and events by shadow-banned Users are excluded.'
            }
          }
        )
        .get('/:id/reports', async ({ request, params: { id }, io }) => {
          return await listReportsHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(ReportSchema),
          detail: { tags: ['Moderation'], summary: 'List Reports', security: asUser }
        })
        .get('/:id/shadow-bans', async ({ request, params: { id }, io }) => {
          return await listShadowBansHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(UserSchema),
          detail: { tags: ['Moderation'], summary: 'List shadow-banned Users', security: asUser }
        })
        .delete('/:id/shadow-bans/:userId', async ({ request, params: { id, userId }, io }) => {
          return await liftShadowBanHandler(request, id, userId, io);
        }, {
          params: t.Object({ id: t.String(), userId: t.String() }),
          response: UserSchema,
          detail: { tags: ['Moderation'], summary: 'Lift a shadow ban', security: asUser }
        })
        .get('/:id/audit', async ({ request, params: { id }, io }) => {
          return await listAuditTrailHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(AuditEntrySchema),
          detail: { tags: ['Moderation'], summary: 'Get the Audit Trail', security: asUser }
        })
        .group('/:id/users', (usersApp) =>
          usersApp
            .get(
              '/',
              async ({ request, params: { id }, io }) => {
                return await listOrgUsersHandler(request, id, io);
              },
              {
                params: t.Object({ id: t.String() }),
                query: t.Object({ search: t.Optional(t.String({ description: 'Filter by name' })) }),
                response: t.Array(UserSchema),
                detail: { tags: ['Users'], summary: 'List Users of an Organization', security: asUser }
              }
            )
            .patch(
              '/:userId/role',
              async ({ request, params: { id, userId }, body, io }) => {
                return await assignRoleHandler(request, id, userId, body, io);
              },
              {
                params: t.Object({ id: t.String(), userId: t.String() }),
                body: ChangeRoleBody,
                response: UserSchema,
                detail: { tags: ['Users'], summary: 'Change a User role', security: asUser }
              }
            )
            .delete(
              '/:userId',
              async ({ request, params: { id, userId }, io }) => {
                await removeUserHandler(request, id, userId, io);
                return { success: true };
              },
              {
                params: t.Object({ id: t.String(), userId: t.String() }),
                response: t.Object({ success: t.Literal(true) }),
                detail: { tags: ['Users'], summary: 'Remove a User from an Organization', security: asUser }
              }
            )
        )
        .group('/:id/devices', (devicesApp) =>
          devicesApp
            .get('/', async ({ request, params: { id }, io }) => {
              return await listActiveDevicesOrgHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(PublicDeviceSchema),
              detail: { tags: ['Device Management'], summary: 'List active Devices', security: asUser }
            })
            .get('/pending', async ({ request, params: { id }, io }) => {
              return await listPendingDevicesOrgHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(PublicDeviceSchema),
              detail: { tags: ['Device Management'], summary: 'List pending Devices that identified this Organization', security: asUser }
            })
            .get('/:deviceId', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: PublicDeviceSchema,
              detail: { tags: ['Device Management'], summary: 'Get a Device', security: asUser }
            })
            .get('/:deviceId/status', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceStatusHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Object({ isOnline: t.Boolean(), latestHeartbeat: t.Nullable(HeartbeatSchema) }),
              detail: {
                tags: ['Device Management'],
                summary: 'Get Device online status',
                description: 'Online means a heartbeat arrived in the last 60 seconds.',
                security: asUser
              }
            })
            .get('/:deviceId/logs', async ({ request, params: { id, deviceId }, io }) => {
              return await getDeviceLogsHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Array(DeviceLogSchema),
              detail: { tags: ['Device Management'], summary: 'List Device logs', security: asUser }
            })
            .get('/:deviceId/telemetry', async ({ request, params: { id, deviceId }, io }) => {
              return await getDetailedTelemetryHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Nullable(DeviceTelemetrySchema),
              detail: {
                tags: ['Device Management'],
                summary: 'Get the latest detailed Telemetry',
                description: 'Null until the Device has sent detailed Telemetry at least once.',
                security: asUser
              }
            })
            .post('/:deviceId/telemetry/request', async ({ request, params: { id, deviceId }, io }) => {
              return await requestTelemetryHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: CommandSchema,
              detail: {
                tags: ['Device Management'],
                summary: 'Request detailed Telemetry',
                description: 'Queues a request_telemetry Command for the Device to pick up.',
                security: asUser
              }
            })
            .get('/:deviceId/commands', async ({ request, params: { id, deviceId }, io }) => {
              return await listCommandsHandler(request, id, deviceId, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              response: t.Array(CommandSchema),
              detail: { tags: ['Device Management'], summary: 'List Commands sent to a Device', security: asUser }
            })
            .post('/:deviceId/commands', async ({ request, params: { id, deviceId }, body, io }) => {
              return await sendCommandHandler(request, id, deviceId, body, io);
            }, {
              params: t.Object({ id: t.String(), deviceId: t.String() }),
              body: CreateCommandBody,
              response: CommandSchema,
              detail: {
                tags: ['Device Management'],
                summary: 'Send a Command to a Device',
                description: 'An update Command requires payload { url, sha256, version? }; Puppet verifies the digest and architecture before installing. Other types take an optional free-form payload.',
                security: asUser
              }
            })
        )
        .group('/:id/events', (eventsApp) =>
          eventsApp
            .post('/', async ({ request, params: { id }, body, io }) => {
              return await createEventHandler(request, id, body, io);
            }, {
              params: t.Object({ id: t.String() }),
              body: CreateEventBody,
              response: EventSchema,
              detail: { tags: ['Events'], summary: 'Create an Event', security: asUser }
            })
            .get('/', async ({ request, params: { id }, io }) => {
              return await listEventsHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(EventSchema),
              detail: { tags: ['Events'], summary: 'List Events', security: asUser }
            })
            .get('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              return await getEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema,
              detail: { tags: ['Events'], summary: 'Get an Event', security: asUser }
            })
            .delete('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              await deleteEventHandler(request, id, eventId, io);
              return { success: true };
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ success: t.Literal(true) }),
              detail: { tags: ['Events'], summary: 'Delete an Event (soft delete)', security: asUser }
            })
            .post('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await voteHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ status: t.Union([t.Literal('voted'), t.Literal('unvoted')]) }),
              detail: { tags: ['Votes'], summary: 'Toggle a Vote on an Event', security: asUser }
            })
            .get('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await getVoteStatusHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ voted: t.Boolean() }),
              detail: { tags: ['Votes'], summary: 'Check whether the logged-in User voted', security: asUser }
            })
            .post('/:eventId/report', async ({ request, params: { id, eventId }, body, io }) => {
              return await reportEventHandler(request, id, eventId, body, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              body: CreateReportBody,
              response: ReportSchema,
              detail: {
                tags: ['Moderation'],
                summary: 'Report an Event',
                description: 'One Report per User per Event. Reaching the Organization threshold hides the Event and shadow-bans its creator.',
                security: asUser
              }
            })
            .post('/:eventId/hide', async ({ request, params: { id, eventId }, io }) => {
              return await hideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema,
              detail: { tags: ['Moderation'], summary: 'Hide an Event', security: asUser }
            })
            .post('/:eventId/unhide', async ({ request, params: { id, eventId }, io }) => {
              return await unhideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema,
              detail: { tags: ['Moderation'], summary: 'Unhide an Event', security: asUser }
            })
        )
    );
}
