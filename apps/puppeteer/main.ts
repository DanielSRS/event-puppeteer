// Local entry: `nub run start`. Vercel uses src/index.ts instead (no listen there).
import { node } from '@elysiajs/node';
import { createServer } from './src/server.ts';
import { createRealIO } from './src/io/index.ts';
import { env } from './src/env.ts';

const app = createServer(createRealIO(), { adapter: node(), appUrl: env.APP_URL });
app.listen(env.PORT);
console.log(`🦊 Server is running at http://localhost:${env.PORT}`);
console.log(`📚 API docs at http://localhost:${env.PORT}/openapi`);
