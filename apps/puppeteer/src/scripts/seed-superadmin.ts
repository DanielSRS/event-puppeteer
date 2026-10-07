// Usage: nub run db:seed:superadmin
// Reads SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (plus the server's DATABASE_URL etc.) from .env
import { z } from 'zod';
import { createRealIO } from '../io/index.ts';
import { seedSuperadminHandler } from '../handlers/seed.ts';
import { ipv6UnreachableHint } from './connection-hint.ts';

const parsed = z.object({
  SUPERADMIN_EMAIL: z.string().email('SUPERADMIN_EMAIL precisa ser um email válido'),
  SUPERADMIN_PASSWORD: z.string().min(8, 'SUPERADMIN_PASSWORD deve ter no mínimo 8 caracteres'),
  SUPERADMIN_FIRST_NAME: z.string().default('Super'),
  SUPERADMIN_LAST_NAME: z.string().default('Admin')
}).safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis do seed inválidas:', parsed.error.format());
  process.exit(1);
}

const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME } = parsed.data;
try {
  const { status, user } = await seedSuperadminHandler({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    firstName: SUPERADMIN_FIRST_NAME,
    lastName: SUPERADMIN_LAST_NAME
  }, createRealIO());

  const messages = { created: 'criado', promoted: 'promovido a Superadmin', unchanged: 'já era Superadmin' };
  console.log(`✅ ${user.email}: ${messages[status]}`);
  process.exit(0);
} catch (error) {
  const hint = ipv6UnreachableHint(error, 'DATABASE_URL', 'Transaction');
  if (hint) console.error(hint);
  else console.error('❌ Falha no seed:', error);
  process.exit(1);
}
