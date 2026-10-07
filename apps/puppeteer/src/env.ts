import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url("A url do banco precisa ser válida"),
  BETTER_AUTH_SECRET: z.string().min(10, "A chave secreta deve ter no mínimo 10 caracteres"),
  BETTER_AUTH_URL: z.string().url("A url de auth deve ser válida"),
  // Brevo (transactional email). Without a key, outside production, emails are printed to the console
  BREVO_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email("EMAIL_FROM precisa ser um email válido").optional(),
  EMAIL_FROM_NAME: z.string().default("Puppeteer"),
  // Public URL of the frontend: where the verification link lands after confirming
  APP_URL: z.string().url("A url do frontend deve ser válida").default("http://localhost:3000"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.BREVO_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'Obrigatória em produção (envio do email de verificação)' });
  }
  if (env.BREVO_API_KEY && !env.EMAIL_FROM) {
    ctx.addIssue({ code: 'custom', path: ['EMAIL_FROM'], message: 'Obrigatória junto com BREVO_API_KEY (remetente verificado no Brevo)' });
  }
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Erro de validação nas variáveis de ambiente:', _env.error.format());
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = _env.data;
