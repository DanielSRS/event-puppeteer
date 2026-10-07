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
import { EventSchema, CreateEventBody } from './types/event.ts';
import { createTagHandler, listTagsHandler, createLinkLabelHandler, listLinkLabelsHandler } from './handlers/system.ts';
import { createEventHandler, listEventsHandler, getEventHandler, deleteEventHandler } from './handlers/events.ts';

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
    .group('/tags', (app) =>
      app
        .post('/', async ({ request, body, io }) => createTagHandler(request, body, io), {
          body: CreateTagBody,
          response: TagSchema
        })
        .get('/', async ({ io }) => listTagsHandler(io), {
          response: t.Array(TagSchema)
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
            .get('/', async ({ params: { id }, io }) => {
              return await listEventsHandler(id, io);
            }, {
              params: t.Object({ id: t.String() }),
              response: t.Array(EventSchema)
            })
            .get('/:eventId', async ({ params: { id, eventId }, io }) => {
              return await getEventHandler(id, eventId, io);
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
