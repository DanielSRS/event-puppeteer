# Puppeteer

## Architecture Pattern

This project follows the **Functional Core / Imperative Shell** pattern to make testing and reasoning easier.

### Guidelines for Future Slices

1. **Define Types & IO Interfaces**: Any side-effectful operations (e.g., database queries, external API calls) should be defined as interfaces in the `src/io/` folder.
2. **Write Pure Handlers**: Handlers should be pure functions with the signature `(request, io) -> response`. They must *not* have any hidden side effects. They must receive an `io` object to perform any necessary operations.
   - Example: `export async function myHandler(request: Request, io: AppIO) { ... }`
3. **In-Memory Implementations**: Every IO interface should have an in-memory implementation for tests, defined in `src/io/in-memory.ts`.
4. **Wire the Shell**: The HTTP layer (in `src/server.ts`) is the imperative shell. It is responsible for assembling the real IO dependencies and injecting them into the pure handlers.
5. **Testing**: Tests must call the handlers directly, passing in the `in-memory` IO implementation, and assert the handler's response and any state changes in the `in-memory` stores. No HTTP server should be spun up for these unit tests.

### Scripts

- `nub run start`: Starts the application server.
- `nub run test`: Runs the test suite using the Node.js native test runner.
- `nub run db:migrate`: Applies pending migrations using `MIGRATION_DATABASE_URL` (or `DATABASE_URL`) from `.env`. On Supabase, point it at the Session pooler or direct connection (port 5432).
- `nub run db:seed:superadmin`: Creates the first Superadmin (or promotes an existing user) from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `.env`. Idempotent. Registration only creates Members, so this is how the first Superadmin is bootstrapped.

### Email verification

New accounts must confirm their email before logging in (`POST /auth/login` answers 403 until then). Registration sends a link to `GET /auth/verify-email`, which marks the email as verified and redirects to `$APP_URL/login?emailVerified=1` (or `0` for an invalid/expired link). `POST /auth/resend-verification` sends a new link. Emails go through Brevo (`BREVO_API_KEY`, `EMAIL_FROM`); without a key outside production they are printed to the console. The Superadmin seed creates an already-verified account.

### Access rules

- Public: `GET /health`, the docs, `POST /auth/register`, `POST /auth/login`, `POST /devices/connect`, and the read routes behind public screens: event list/feed/details, `GET /organizations/:id` (TV branding), `GET /tags`, `GET /link-labels`. Everything else requires a token; `src/server.test.ts` fails if a route is exposed by mistake.
- A Superadmin has no Organization; every other User has exactly one. `User` is a union discriminated by `role`, and the database enforces the same rule (`user_role_organization` check).

### API Documentation

The server publishes an OpenAPI spec via [`@elysiajs/openapi`](https://elysiajs.com/plugins/openapi.html):

- `GET /openapi`: interactive docs (Scalar)
- `GET /openapi/json`: raw OpenAPI spec

Docs are generated from each route's `body`/`params`/`query`/`response` schemas. When adding a route, also give it a `detail` with `tags`, a `summary`, and `security` (`asUser` or `asDevice`, defined in `src/server.ts`) when it requires a token.
