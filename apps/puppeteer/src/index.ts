// Vercel entry (zero-config Elysia): default-export the app, Vercel serves it.
// Local development runs main.ts instead.
// Vercel only accepts an entry whose source matches `from 'elysia'`; without this
// import it skips this file and picks src/server.ts, which has no default export.
import type { Elysia } from 'elysia';
import { waitUntil } from '@vercel/functions';
import { createServer } from './server.ts';
import { createRealIO } from './io/index.ts';
import { env } from './env.ts';

const app: Elysia<any, any, any, any, any, any, any> = createServer(createRealIO({ keepAlive: waitUntil }), { appUrl: env.APP_URL });

export default app;
