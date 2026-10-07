import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';
import { createRealIO, AppIO } from './io/index.ts';
import { healthCheck } from './handlers/health.ts';

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
export function createServer(io: AppIO) {
  return new Elysia({ adapter: node() })
    .decorate('io', io)
    .get('/health', ({ request, io }) => healthCheck(request, io));
}

export function startServer(port = 3000) {
  const io = createRealIO(); // Wire up the real IO for production
  const app = createServer(io);
  app.listen(port);
  console.log(`🦊 Server is running at http://localhost:${port}`);
  return app;
}
