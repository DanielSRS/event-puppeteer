// Local entry: `nub run start`. Vercel uses src/index.ts instead (no listen there).
import { createServer as createNetServer } from 'node:net';
import { node } from '@elysiajs/node';
import { createServer } from './src/server.ts';
import { createRealIO } from './src/io/index.ts';
import { env } from './src/env.ts';

// The Node adapter's listen() swallows bind errors and still "runs", so check first
await new Promise<void>((resolve) => {
  const probe = createNetServer()
    .once('error', (error: NodeJS.ErrnoException) => {
      console.error(error.code === 'EADDRINUSE'
        ? `❌ A porta ${env.PORT} já está em uso (outra instância da API?). Pare-a ou defina outra PORT.`
        : `❌ Não foi possível usar a porta ${env.PORT}: ${error.message}`);
      process.exit(1);
    })
    .once('listening', () => probe.close(() => resolve()))
    .listen(env.PORT);
});

/** A local process never pauses, so the Wake-up connection needs no keep-alive. */
const io = createRealIO({ keepAlive: () => undefined });
const app = createServer(io, { adapter: node(), appUrl: env.APP_URL });
app.listen(env.PORT);
console.log(`🦊 Server is running at http://localhost:${env.PORT}`);
console.log(`📚 API docs at http://localhost:${env.PORT}/openapi`);

// The adapter's own SIGINT handler only closes the HTTP server; the database pool
// would keep the process alive. Close both, then exit. A second Ctrl+C exits at once.
let stopping = false;
async function shutdown(signal: NodeJS.Signals) {
  if (stopping) process.exit(1);
  stopping = true;
  console.log(`\n${signal}: encerrando...`);
  const forced = setTimeout(() => process.exit(1), 10_000);
  forced.unref();
  await Promise.allSettled([app.stop(), io.close()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
