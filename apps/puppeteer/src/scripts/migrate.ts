// Usage: nub run db:migrate
// Applies pending migrations from src/db/migrations; already-applied ones are skipped.
// Reads MIGRATION_DATABASE_URL, falling back to DATABASE_URL (nub loads .env).
// On Supabase use the Session pooler or direct connection (port 5432) here: the
// Transaction pooler (6543) that the API uses is not meant for migrations.
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const parsed = z.object({
  MIGRATION_DATABASE_URL: z.string().url('MIGRATION_DATABASE_URL precisa ser uma url válida').optional(),
  DATABASE_URL: z.string().url('DATABASE_URL precisa ser uma url válida').optional()
}).safeParse(process.env);

const url = parsed.success ? (parsed.data.MIGRATION_DATABASE_URL ?? parsed.data.DATABASE_URL) : undefined;
if (!url) {
  console.error('❌ Defina MIGRATION_DATABASE_URL ou DATABASE_URL no .env', parsed.success ? '' : parsed.error.format());
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const migrationsFolder = fileURLToPath(new URL('../db/migrations', import.meta.url));

try {
  console.log(`⏳ Aplicando migrations em ${new URL(url).host}...`);
  await migrate(drizzle(client), { migrationsFolder });
  console.log('✅ Banco atualizado');
} catch (error) {
  console.error('❌ Falha na migration:', error);
  process.exitCode = 1;
} finally {
  await client.end();
}
