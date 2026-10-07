// Vercel entry (zero-config Elysia): default-export the app, Vercel serves it.
// Local development runs main.ts instead.
import { createServer } from './server.ts';
import { createRealIO } from './io/index.ts';

export default createServer(createRealIO());
