import { Elysia } from 'elysia';
import { node } from '@elysiajs/node';
import { createInMemoryIO } from './io/in-memory.ts';
import { healthCheck } from './handlers/health.ts';
import { IO } from './io/index.ts';

// Wire the imperative shell: the HTTP layer assembles real IO and passes it to handlers
export function createServer(io: IO) {
  return new Elysia({ adapter: node() })
    .decorate('io', io)
    .get('/health', ({ request, io }) => healthCheck(request, io));
}

export function startServer(port = 3000) {
  const io = createInMemoryIO(); // For now, we wire up the in-memory IO
  const app = createServer(io);
  app.listen(port);
  console.log(`🦊 Server is running at http://localhost:${port}`);
  return app;
}
