# Event Puppeteer

A system for publishing institutional events and showing them on kiosk displays. People browse and manage events on the web, an API keeps the data and the rules, and a small C agent on each kiosk keeps its display up to date.

The vocabulary used across the project (Puppeteer, Puppet, Device, Public Feed, Shadow Ban and others) is defined in [CONTEXT.md](CONTEXT.md). Use those terms in code, docs and issues.

## Applications

This is a monorepo with three applications under `apps/`:

| App | What it is | Stack | Docs |
|---|---|---|---|
| [`puppeteer`](apps/puppeteer) | The server (API). Manages Organizations, Devices, Events, Users, moderation and Image screening. | TypeScript, Elysia, Drizzle, better-auth | [README](apps/puppeteer/README.md), [ADRs](apps/puppeteer/docs/adr) |
| [`puppet-show`](apps/puppet-show) | The web front end: the public Public Feed, the TV mode for kiosks and the role-based Unified Dashboard. In Portuguese. | Next.js, TanStack Query, Storybook | [README](apps/puppet-show/README.md) |
| [`puppet`](apps/puppet) | The agent that runs on each kiosk Device. Enrolls with Puppeteer, waits for approval, then keeps the event feed current, sends heartbeats and Telemetry, and runs Commands. | C, CMake, libcurl, MMKV | [README](apps/puppet/README.md), [docs](apps/puppet/docs/README.md), [ADRs](apps/puppet/docs/adr) |

```
 puppet-show (web) ──HTTP──▶ puppeteer (API) ◀──HTTP── puppet (agent on each kiosk)
```

puppet-show never talks to a Device directly. Both clients use the Puppeteer API, which is the single source of truth.

## Getting started

The repository uses [nub](https://www.npmjs.com/package/nub) 0.9 as its package manager and TypeScript 7.

```bash
nub install        # install the dependencies of every app
```

Then follow the README of the app you want to run:

- **puppeteer**: copy the environment variables listed in its README, then `nub run db:migrate`, `nub run db:seed:superadmin` and `nub run start`. The interactive API docs are served at `GET /openapi`.
- **puppet-show**: copy `.env.example` to `.env`, point `PUPPETEER_URL` to the API, then `npm run dev`.
- **puppet**: build with CMake, giving it Puppeteer's URL at configure time. On a kiosk, install it with the `./puppet` Installation flow described in its README.

## Tests

| App | Command |
|---|---|
| puppeteer | `nub run test` (in-memory IO, no server or external service needed) |
| puppet-show | `npm run test:unit`, `npm run test:stories`, `npm run test:e2e` (the end-to-end tests run against the real API) |

## Repository conventions

- Decisions are recorded as ADRs next to the app they affect (`apps/*/docs/adr`).
- Work is tracked in GitHub issues. See [docs/agents](docs/agents) for the issue tracker, triage labels and domain documentation conventions used by coding agents ([AGENTS.md](AGENTS.md)).
- Shared dependencies keep one version across all apps.
- No mocks or simulated APIs in application code. If an endpoint does not exist, the interface does not offer the action.
- No silent fallbacks and no thrown errors for expected failures: errors are values, and every one is handled and shown to the user.
