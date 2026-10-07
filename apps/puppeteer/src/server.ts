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

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
export function createServer(io: AppIO) {
  return new Elysia({ adapter: node() })
    .decorate('io', io)
    .get(
      '/health', 
      ({ request, io }) => healthCheck(request, io),
      {
        response: t.Object({
          status: t.Literal('ok')
        })
      }
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
    );
}

export function startServer(port = 3000) {
  const io = createRealIO(); // Wire up the real IO for production
  const app = createServer(io);
  app.listen(port);
  console.log(`🦊 Server is running at http://localhost:${port}`);
  return app;
}
