// Vercel entry (zero-config Elysia): default-export the app, Vercel serves it.
// Local development runs main.ts instead.
// Vercel only accepts an entry whose source matches `from 'elysia'`; without this
// import it skips this file and picks src/server.ts, which has no default export.
import type { Elysia } from 'elysia';
import { createServer } from './server.ts';
import { createRealIO } from './io/index.ts';

const app: Elysia<any, any, any, any, any, any, any> = createServer(createRealIO());

export default app;
