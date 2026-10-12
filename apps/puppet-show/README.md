<h1 align="center">puppet-show</h1>

<p align="center">
  Front-end do mural de eventos: o <strong>Mural</strong> público, onde qualquer pessoa da organização encontra, curte, compartilha e denuncia eventos; o <strong>Modo TV</strong> para os totens; e o <strong>Painel</strong>, que mostra a cada papel (Membro, Moderador, Admin, Superadmin) as ferramentas que ele pode usar.
</p>

Todos os dados vêm da API **Puppeteer** (`apps/puppeteer`). O vocabulário do domínio está em [`CONTEXT.md`](../../CONTEXT.md) e a especificação na issue #1 do GitHub.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Mural: busca, filtros (Todos, Mais próximos, Mais curtidos e uma pílula por tag oficial), cards com data, horário, local, tags e curtidas. O mural é recarregado a cada 5 s enquanto a aba está visível (a API não tem push), e a curtida aparece na hora e é confirmada pelo servidor. |
| `/eventos/[id]` | Detalhes: programação de vários dias, mapa (OpenStreetMap), links (ex.: Inscrição), curtir, compartilhar, denunciar; o autor pode excluir e Moderadores+ podem ocultar ou reexibir. |
| `/eventos/novo` | Publicar evento: o mesmo editor do painel. |
| `/display` | Modo TV: relógio, QR code para o site e rotação de 3 em 3 eventos (15 s + 1 s por curtida na janela). |
| `/entrar`, `/cadastro` | Login e cadastro com confirmação de e-mail. |
| `/esqueci-senha`, `/redefinir-senha` | Esqueci minha senha: a pessoa recebe por e-mail um link (válido por 1 hora, uso único) para escolher uma nova senha; as sessões abertas são encerradas. |
| `/dashboard/...` | Painel: Meus Eventos; Denúncias, Imagens em Revisão, Usuários Banidos e Tags Sugeridas (Moderador+); Auditoria, Usuários, Dispositivos e Configurações, onde fica o logo (Admin+); Organizações, Dispositivos Órfãos, Tags e Links Globais, Imagens Escalonadas e Política de Triagem (Superadmin no contexto "Sistema Global"). O Superadmin troca de contexto pelo seletor no topo do menu, e a escolha fica salva. |

## Configuração

Copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Para quê |
|---|---|---|
| `PUPPETEER_URL` | sim | URL da API. O Next encaminha `/api/*` para ela (sem CORS). Sem ela o app não inicia. |
| `NEXT_PUBLIC_ORG_ID` | sim | Organização que visitantes veem (mural, Modo TV) e na qual os cadastros entram. |
| `NEXT_PUBLIC_SITE_URL` | sim | Endereço público do site, usado nos QR codes. |

## Comandos

Dependências com `nub install` na raiz do repositório.

```bash
npm run dev            # next dev
npm run storybook      # Storybook em http://localhost:6006 (inclui o servidor MCP)
npm run test:unit      # funções puras (Vitest, Node)
npm run test:stories   # cada story é um teste de componente + acessibilidade (axe), no Chromium
npm run test:e2e       # fluxos completos contra a API real; veja e2e/README.md
npx tsc --noEmit -p . && npx tsc --noEmit -p e2e   # typecheck do app (com stories) e dos testes E2E
npm run lint
```

## Organização do código

- `lib/api/`: o contrato da API (`schemas.ts`, em zod; os tipos do app são inferidos dele) e o cliente HTTP (`client.ts`). Toda resposta é validada, e nenhuma chamada lança exceção: o retorno é um `Result` (`lib/result.ts`) e `ApiErrorMessage` transforma a falha em texto para a pessoa.
- `domain/`: regras puras do mural (filtros, programação, curtidas, links, tempo da TV), com testes unitários.
- `components/`: componentes de apresentação (recebem dados por props e têm stories) e *containers* (`*Container.tsx`), que chamam a API e tratam cada erro. `components/ui/` tem os blocos compartilhados (mensagens de erro e status, `Drawer` e `ConfirmDialog` sobre o `<dialog>` nativo).
- `components/dashboard/DashboardSections.ts`: a regra única de quais seções cada papel vê em cada contexto (espelha as permissões da API). O layout do painel usa essa regra para proteger todas as páginas.
- `utils/validation/`: validações dos formulários, com testes.

## Convenções

- Sem mocks nem APIs simuladas no código do app; se um endpoint não existe, a interface não oferece a ação.
- Sem fallbacks silenciosos: configuração ausente ou dado inválido aparece como erro explícito.
- Erros como valores (`Result`); toda falha é mostrada para a pessoa.
- Sem `any`. Comentários só como documentação JSDoc.
- Todas as telas funcionam em 390 px (celular) sem rolagem horizontal e por teclado.

## Extensões recomendadas para IDE

- ESLint (Microsoft)
- Tailwind CSS IntelliSense (Tailwind Labs)
- Color Info (Matt Bierner)
- TypeScript 7 (Microsoft)
