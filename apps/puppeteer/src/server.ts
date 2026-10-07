import { Elysia, t } from 'elysia';
import { node } from '@elysiajs/node';
import { createRealIO } from './io/index.ts';
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
import { connectDeviceHandler, listPendingDevicesGlobalHandler, listPendingDevicesOrgHandler, listActiveDevicesOrgHandler, getDeviceHandler, approveDeviceHandler, rejectDeviceHandler } from './handlers/devices.ts';
import { DeviceSchema, ConnectDeviceBody, ApproveDeviceBody } from './types/device.ts';
import { heartbeatHandler, postLogHandler, postTelemetryHandler, ackCommandHandler, completeCommandHandler, getDeviceStatusHandler, getDeviceLogsHandler, getDetailedTelemetryHandler, sendCommandHandler, requestTelemetryHandler, listCommandsHandler } from './handlers/telemetry.ts';
import { PostLogBody, DeviceTelemetrySchema, DeviceLogSchema, HeartbeatSchema } from './types/telemetry.ts';
import { CreateCommandBody, CommandSchema } from './types/command.ts';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './handlers/system.ts';
import { createEventHandler, listEventsHandler, getEventHandler, deleteEventHandler } from './handlers/events.ts';
import { voteHandler, getVoteStatusHandler } from './handlers/votes.ts';
import { eventFeedHandler } from './handlers/feed.ts';
import { ReportSchema, CreateReportBody, AuditEntrySchema } from './types/moderation.ts';
import { reportEventHandler, listReportsHandler, hideEventHandler, unhideEventHandler, listShadowBansHandler, liftShadowBanHandler, promoteTagHandler, listAuditTrailHandler } from './handlers/moderation.ts';

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
export function createServer(io: AppIO) {
  return new Elysia({ adapter: node() })
    .decorate('io', io)
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
        })
      }
    )
    
    .group('/devices', (app) =>
      app
        .post('/connect', async ({ body, io }) => {
          return await connectDeviceHandler(body, io);
        }, {
          body: ConnectDeviceBody,
          response: t.Object({ device: DeviceSchema, token: t.String() })
        })
        .get('/pending', async ({ request, io }) => {
          return await listPendingDevicesGlobalHandler(request, io);
        }, {
          response: t.Array(DeviceSchema)
        })
        .post('/:deviceId/approve', async ({ request, params: { deviceId }, body, io }) => {
          return await approveDeviceHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: ApproveDeviceBody,
          response: DeviceSchema
        })
        
        .post('/:deviceId/heartbeat', async ({ request, params: { deviceId }, body, io }) => {
          return await heartbeatHandler(request, deviceId, (body as any).status, (body as any).errors, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: t.Object({ status: t.String(), errors: t.Optional(t.Array(t.String())) }),
          response: t.Object({ success: t.Boolean() })
        })
        .post('/:deviceId/logs', async ({ request, params: { deviceId }, body, io }) => {
          return await postLogHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: PostLogBody,
          response: t.Object({ success: t.Boolean() })
        })
        .post('/:deviceId/telemetry', async ({ request, params: { deviceId }, body, io }) => {
          return await postTelemetryHandler(request, deviceId, body, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          body: DeviceTelemetrySchema,
          response: t.Object({ success: t.Boolean() })
        })
        .post('/:deviceId/commands/:commandId/ack', async ({ request, params: { deviceId, commandId }, io }) => {
          return await ackCommandHandler(request, deviceId, commandId, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          response: CommandSchema
        })
        .post('/:deviceId/commands/:commandId/complete', async ({ request, params: { deviceId, commandId }, body, io }) => {
          return await completeCommandHandler(request, deviceId, commandId, (body as any).success, io);
        }, {
          params: t.Object({ deviceId: t.String(), commandId: t.String() }),
          body: t.Object({ success: t.Boolean() }),
          response: CommandSchema
        })
        .post('/:deviceId/reject', async ({ request, params: { deviceId }, io }) => {
          return await rejectDeviceHandler(request, deviceId, io);
        }, {
          params: t.Object({ deviceId: t.String() }),
          response: DeviceSchema
        })
    )
    .group('/tags', (app) =>
      app
        .post('/', async ({ request, body, io }) => createTagHandler(request, body, io), {
          body: CreateTagBody,
          response: TagSchema
        })
        .get('/', async ({ io }) => listTagsHandler(io), {
          response: t.Array(TagSchema)
        })
        .post('/:tagId/promote', async ({ request, params: { tagId }, io }) => {
          return await promoteTagHandler(request, tagId, io);
        }, {
          params: t.Object({ tagId: t.String() }),
          response: TagSchema
        })
    )
    .group('/link-labels', (app) =>
      app
        .post('/', async ({ request, body, io }) => createLinkLabelHandler(request, body, io), {
          body: CreateLinkLabelBody,
          response: LinkLabelSchema
        })
        .get('/', async ({ io }) => listLinkLabelsHandler(io), {
          response: t.Array(LinkLabelSchema)
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
            })
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
            })
          }
        )
        .get(
          '/me',
          async ({ request, io }) => {
            return await meHandler(request, io);
          },
          {
            response: UserSchema
          }
        )
    )
    .group('/organizations', (app) =>
      app
        .post(
          '/',
          async ({ body, io }) => {
            return await createOrganizationHandler(body, io);
          },
          {
            body: CreateOrganizationBody,
            response: OrganizationSchema
          }
        )
        .get(
          '/',
          async ({ io }) => {
            return await listOrganizationsHandler(io);
          },
          {
            response: t.Array(OrganizationSchema)
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
            }
          }
        )
        .patch(
          '/:id',
          async ({ params: { id }, body, io, set }) => {
            const org = await updateOrganizationHandler(id, body, io);
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
            }
          }
        )
        .get(
          '/:id/feed',
          async ({ params: { id }, io }) => {
            return await eventFeedHandler(id, io);
          },
          {
            params: t.Object({ id: t.String() }),
            response: t.Array(FeedEventSchema)
          }
        )
        .get('/:id/reports', async ({ request, params: { id }, io }) => {
          return await listReportsHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(ReportSchema)
        })
        .get('/:id/shadow-bans', async ({ request, params: { id }, io }) => {
          return await listShadowBansHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(UserSchema)
        })
        .delete('/:id/shadow-bans/:userId', async ({ request, params: { id, userId }, io }) => {
          return await liftShadowBanHandler(request, id, userId, io);
        }, {
          params: t.Object({ id: t.String(), userId: t.String() }),
          response: UserSchema
        })
        .get('/:id/audit', async ({ request, params: { id }, io }) => {
          return await listAuditTrailHandler(request, id, io);
        }, {
          params: t.Object({ id: t.String() }),
          response: t.Array(AuditEntrySchema)
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
                response: t.Array(UserSchema)
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
                response: UserSchema
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
                response: t.Object({ success: t.Literal(true) })
              }
            )
        )
        .group('/:id/events', (eventsApp) =>
          eventsApp
            .post('/', async ({ request, params: { id }, body, io }) => {
              return await createEventHandler(request, id, body, io);
            }, {
              params: t.Object({ id: t.String() }),
              body: CreateEventBody,
              response: EventSchema
            })
            .get('/', async ({ request, params: { id }, io }) => {
              return await listEventsHandler(request, id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(EventSchema)
            })
            .get('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              return await getEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema
            })
            .delete('/:eventId', async ({ request, params: { id, eventId }, io }) => {
              await deleteEventHandler(request, id, eventId, io);
              return { success: true };
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ success: t.Literal(true) })
            })
            .post('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await voteHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ status: t.Union([t.Literal('voted'), t.Literal('unvoted')]) })
            })
            .get('/:eventId/vote', async ({ request, params: { id, eventId }, io }) => {
              return await getVoteStatusHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: t.Object({ voted: t.Boolean() })
            })
            .post('/:eventId/report', async ({ request, params: { id, eventId }, body, io }) => {
              return await reportEventHandler(request, id, eventId, body, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              body: CreateReportBody,
              response: ReportSchema
            })
            .post('/:eventId/hide', async ({ request, params: { id, eventId }, io }) => {
              return await hideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema
            })
            .post('/:eventId/unhide', async ({ request, params: { id, eventId }, io }) => {
              return await unhideEventHandler(request, id, eventId, io);
            }, {
              params: t.Object({ id: t.String(), eventId: t.String() }),
              response: EventSchema
            })
        )
    );
}

export function startServer(port = 3000) {
  const io = createRealIO(); // Wire up the real IO for production
  const app = createServer(io);
  app.listen(port);
  console.log(`🦊 Server is running at http://localhost:${port}`);
  return app;
}
