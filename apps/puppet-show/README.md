<h1 align="center">
  Eventos
</h1>

<p align="center">
  Este projeto é um mural de eventos onde qualquer pessoa pode criar uma conta, publicar um evento, curtir e se inscrever. Na tela grande a lista rola sozinha e um QR Code leva o visitante para a versão do celular.
</p>

## Extensões recomendadas para IDE

- Color Info (by Matt Bierner)
- Drizzle ORM snippets (by Manuel Gil)
- ESLint (by Microsoft)
- JavaScript and TypeScript Nightly (by Microsoft)
- Tailwind CSS IntelliSense (by Tailwind Labs)
- TypeScript 7 (by Microsoft)

## Configurações de ambiente

```bash
npm install drizzle-orm postgres dotenv
npm install -D drizzle-kit tsx
npm install react-icons
npm install jose
npm install bcryptjs
npm install qrcode
npm install --save-dev @types/qrcode
```

Propriedade adicionada ao `package.json`:

```bash
"type": "module",
```

## Drizzle ORM

Foi criado dentro da pasta raíz o arquivo <code>drizzle.config.ts</code> e foi adicionado dentro deste arquivo o seguinte código:
```bash
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Confira o arquivo .env.");
};

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
```

### • Gerando o Banco de Dados

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Scripts no `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio"
```

A partir dai, pode-se usar o comando <code>npm run</code> seguido dos atalhos acima, exemplo: <code>npm run db:generate</code>

**Antes de rodar qualquer comando do Drizzle**, pare o `npm run dev`

### • Tabelas criadas

| Tabela | Para que serve |
|---|---|
| `users` | Contas de quem publica, curte e se inscreve |
| `events` | Eventos publicados |
| `event_likes` | Uma curtida por pessoa em cada evento |
| `event_subscriptions` | Uma inscrição por pessoa em cada evento |

### • Informações do .env
<div>
  No arquivo <code>.env</code> foram configuradas as seguintes variáveis:
</div>

```bash
JWT_SECRET=Código de segurança longo, da sua preferência (sem aspas)
DATABASE_URL="Link fornecido pelo Supabase na área de Conexão" (com aspas)
NEXT_PUBLIC_SITE_URL=Endereço do site que vai dentro do QR Code (sem aspas)
```

### • Para gerar um JWT Secret
<div>
  No terminal, pode-se escrever o seguinte comando para gerar uma chave <code>JWT_SECRET</code> para utilizar no seu código:
</div>

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### • Para testar o QR Code no celular
<div>
  Em desenvolvimento, o endereço <code>localhost</code> não funciona no celular. Descubra o IP da sua máquina com <code>ipconfig</code> no Windows ou <code>ifconfig</code> no Linux e use ele no <code>.env</code>:
</div>

```bash
NEXT_PUBLIC_SITE_URL=http://192.168.0.10:3000
```

<div>
  O celular precisa estar na mesma rede Wi-Fi do computador.
</div>

## Configurações no Supabase:

<div>
  Foram executados os seguintes comandos abaixo no SQL Editor do Supabase:
</div>

<br/>

### • Ativar Row Level Security nas tabelas do projeto:

```bash
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drizzle."__drizzle_migrations" ENABLE ROW LEVEL SECURITY;
```

### • Bloquear acesso público às tabelas

```bash
CREATE POLICY "Block public access"
ON "users"
FOR ALL
TO anon, authenticated
USING (false);

CREATE POLICY "Block public access"
ON "events"
FOR ALL
TO anon, authenticated
USING (false);

CREATE POLICY "Block public access"
ON "event_likes"
FOR ALL
TO anon, authenticated
USING (false);

CREATE POLICY "Block public access"
ON "event_subscriptions"
FOR ALL
TO anon, authenticated
USING (false);
```

<div>
  O site continua funcionando normalmente, porque ele conversa com o banco pela <code>DATABASE_URL</code>, e não pela API pública do Supabase.
</div>

## Como o site funciona

### • Tela grande (TV ou monitor)

- A lista de eventos rola sozinha, em looping, e pausa quando o mouse passa por cima.
- A lista se atualiza a cada 15 segundos, então a ordem acompanha as curtidas sem ninguém mexer.
- Em monitor deitado, o QR Code fica ao lado da lista. Em monitor em pé, ele vira um rodapé.
- O QR Code é gerado no servidor como SVG, então nada é carregado de fora.

### • Celular

- A mesma lista, com os botões de curtir e de se inscrever.
- Os dois botões funcionam como interruptor: tocar de novo desfaz.
- Quem não está logado vê um convite para entrar.

### • Regras

- Os eventos mais curtidos ficam no topo. Em caso de empate, vale a data mais próxima.
- Eventos com data no passado não podem ser cadastrados e saem da lista, com a data contada no horário de Brasília.
- Curtir e se inscrever exigem login, senão daria para inflar as curtidas só atualizando a página.
- O nome da conta é salvo padronizado, no formato "Maria Da Silva".

## Estrutura de pastas

```bash
app/
├── page.tsx                      lista de eventos e QR Code
├── entrar/  cadastro/            telas de conta
├── eventos/novo/                 publicar evento
└── api/
    ├── users/                    cadastro, login, logout e sessão
    └── events/                   listar, publicar, curtir e inscrever
components/                       navbar, cards, formulários e QR Code
hooks/                            sessão e eventos
db/                               schema e conexão
utils/                            token, sessão, datas e validações
proxy.ts                          protege as páginas e APIs privadas
```