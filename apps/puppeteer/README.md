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

Forgotten passwords: `POST /auth/request-password-reset` (always answers success, so it doesn't reveal accounts) emails a link to `$APP_URL/redefinir-senha?token=…`, valid for 60 minutes. `POST /auth/reset-password` with that token and the new password sets it once and ends every session of the account. Removed accounts never get a link and can't log in again through one.

### Images (banners and logos)

Event banners (16:9, at least 960×540) and Organization logos (1:1, at least 256×256) are uploaded as multipart `file` to `PUT /organizations/:id/events/:eventId/banner` and `PUT /organizations/:id/logo`, never set as URLs. Each upload is normalized with `sharp` (EXIF orientation applied, metadata stripped, re-encoded as WebP, scaled down to 1920×1080 or 512×512 when larger), screened, given a thumbhash (the Placeholder), and stored in Cloudinary as an `authenticated` asset. See `CONTEXT.md` for the vocabulary and `docs/adr/0003` and `0004` for the decisions.

- Screening combines Sightengine and OpenAI omni-moderation (the most severe score wins) against the Screening Policy (`GET`/`PUT /screening-policy`, Superadmin). Until a policy is set, and whenever Screening fails, Images wait in Image Review.
- Image Review: `GET /organizations/:id/image-reviews` (Moderator+), `GET /image-reviews/escalated` (Superadmin), `POST /image-reviews/:imageId/approve|reject`. Nobody reviews their own Image; a rejection there shadow-bans the uploader.
- Responses carry `banner`/`logo` as `{ url?, thumbhash }` resolved per viewer: the uploader always sees their latest Image through an expiring signed URL; everyone else sees the latest Approved Image, or only the thumbhash.
- Required environment: `SIGHTENGINE_API_USER`, `SIGHTENGINE_API_SECRET`, `OPENAI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Tests use in-memory doubles (`createInMemoryIO`) and need none.

### Access rules

- Public: `GET /health`, the docs, `POST /auth/register`, `POST /auth/login`, `POST /devices/connect`, and the read routes behind public screens: event list/feed/details, `GET /organizations/:id` (TV branding), `GET /tags`, `GET /link-labels`. Everything else requires a token; `src/server.test.ts` fails if a route is exposed by mistake.
- A Superadmin has no Organization; every other User has exactly one. `User` is a union discriminated by `role`, and the database enforces the same rule (`user_role_organization` check).

### API Documentation

The server publishes an OpenAPI spec via [`@elysiajs/openapi`](https://elysiajs.com/plugins/openapi.html):

- `GET /openapi`: interactive docs (Scalar)
- `GET /openapi/json`: raw OpenAPI spec

Docs are generated from each route's `body`/`params`/`query`/`response` schemas. When adding a route, also give it a `detail` with `tags`, a `summary`, and `security` (`asUser` or `asDevice`, defined in `src/server.ts`) when it requires a token.
