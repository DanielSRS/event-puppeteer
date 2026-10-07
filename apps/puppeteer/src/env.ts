import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url("A url do banco precisa ser válida"),
  BETTER_AUTH_SECRET: z.string().min(10, "A chave secreta deve ter no mínimo 10 caracteres"),
  BETTER_AUTH_URL: z.string().url("A url de auth deve ser válida"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Erro de validação nas variáveis de ambiente:', _env.error.format());
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = _env.data;
