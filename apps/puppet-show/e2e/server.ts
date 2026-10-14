/**
 * Test-only stack for the end-to-end suite.
 *
 * Starts the real Puppeteer API (in-memory Postgres via PGlite, real
 * better-auth) and seeds it through its own HTTP layer with every role:
 * - superadmin; orgA "Universidade Estadual" with admin, moderador, membro and
 *   relator; orgB "Outra Organização" with outro;
 * - tags Tecnologia/Cultura (system) and robotica (free-form), link label Inscrição;
 * - events in both orgs (one with two days, a tag, a link, a vote and a report);
 * - devices: one orphan (Superadmin queue), one pending in orgA, one active in
 *   orgA with heartbeat, telemetry and a log.
 *
 * The Screening Policy is set to 30% (review) / 80% (reject) in every category
 * and the in-memory screener answers violence 50% for every Image, so each
 * upload waits in Image Review. Stored Images are served by this bridge at
 * `/__e2e/images/<id>.webp`, so pages load real pictures.
 *
 * Accounts register through the real flow (sign-up, open the emailed link, log
 * in). The seeded ids are written to `.state.json` and served at
 * `/__e2e/state`; the email outbox at `/__e2e/emails`. After seeding, it starts
 * `next dev` pointed at the API: the frontend needs the public organization id
 * at build time, so it can only start once the seed exists.
 *
 * Run from apps/puppeteer (its migrations folder is relative to the cwd) with
 * nub; `run.ts` does this for the suite.
 *
 * @module
 */

import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInMemoryIO } from "../../puppeteer/src/io/in-memory.ts";
import { InMemoryImageStore } from "../../puppeteer/src/io/image-store/in-memory.ts";
import { createServer } from "../../puppeteer/src/server.ts";
import { seedSuperadminHandler } from "../../puppeteer/src/handlers/seed.ts";
import { E2E, type E2EState } from "./config.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** The in-memory image store, with URLs this bridge serves. */
class BridgedImageStore extends InMemoryImageStore {
  override publicUrl(id: string): string {
    return `http://localhost:${E2E.apiPort}/__e2e/images/${id}.webp`;
  }

  override signedUrl(id: string): string {
    return `http://localhost:${E2E.apiPort}/__e2e/images/${id}.webp?signed`;
  }
}

const io = await createInMemoryIO();
io.imageStore = new BridgedImageStore();
const app = createServer(io, { appUrl: `http://localhost:${E2E.webPort}` });

type Json = Record<string, unknown> | unknown[];

/** Calls the API in-process through its HTTP layer; any non-2xx answer aborts the seed. */
async function call(method: string, path: string, token?: string, body?: Json) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await app.handle(new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }));
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Logs a seeded account in and returns its session token. */
async function login(email: string) {
  const { token } = await call("POST", "/auth/login", undefined, { email, password: E2E.password });
  return token as string;
}

/** Registers through the real flow (sign-up, open the emailed link, log in) and returns the id and session token. */
async function registerVerified(orgId: string, firstName: string, lastName: string, email: string) {
  const { user } = await call("POST", `/auth/register?orgId=${orgId}`, undefined, { firstName, lastName, email, password: E2E.password });
  const message = io.emailSender.sent.findLast((m) => m.to.email === email);
  const link = message?.text.match(/https?:\/\/\S+verify-email\?token=\S+/)?.[0];
  if (!link) throw new Error(`No verification email for ${email}`);
  await app.handle(new Request(link.replace(/^https?:\/\/[^/]+/, "http://localhost")));
  return { id: user.id as string, token: await login(email) };
}

/** `YYYY-MM-DD`, `days` from today (UTC, like the API). */
function DaysFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

await seedSuperadminHandler({ firstName: "Sara", lastName: "Super", email: E2E.users.superadmin, password: E2E.password }, io);
const superToken = await login(E2E.users.superadmin);

const cutOffs = { lower: 0.3, upper: 0.8 };
await call("PUT", "/screening-policy", superToken, {
  nudity: cutOffs, gore: cutOffs, violence: cutOffs, weapons: cutOffs, hate: cutOffs, offensive_gesture: cutOffs, offensive_text: cutOffs,
});
io.imageScreener.scores = { ...io.imageScreener.scores, violence: 0.5 };

const orgA = await call("POST", "/organizations", superToken, { name: "Universidade Estadual", slug: "uefs", colorScheme: "#2563eb" });
const orgB = await call("POST", "/organizations", superToken, { name: "Outra Organização", slug: "outra", colorScheme: "#16a34a" });

const admin = await registerVerified(orgA.id, "Ana", "Admin", E2E.users.admin);
const moderator = await registerVerified(orgA.id, "Marcos", "Moderador", E2E.users.moderator);
const member = await registerVerified(orgA.id, "Maria", "Membro", E2E.users.member);
const reporter = await registerVerified(orgA.id, "Rui", "Relator", E2E.users.reporter);
const outsider = await registerVerified(orgB.id, "Otto", "Outro", E2E.users.outsider);

await call("PATCH", `/organizations/${orgA.id}/users/${admin.id}/role`, superToken, { role: "Admin" });
await call("PATCH", `/organizations/${orgA.id}/users/${moderator.id}/role`, superToken, { role: "Moderator" });

const tech = await call("POST", "/tags", superToken, { name: "Tecnologia", isSystemDefined: true });
await call("POST", "/tags", superToken, { name: "Cultura", isSystemDefined: true });
await call("POST", "/tags", superToken, { name: "robotica", isSystemDefined: false });
const signup = await call("POST", "/link-labels", superToken, { name: "Inscrição" });

/** Body of an event happening on the given days from today, 14:00–16:00. */
const event = (title: string, days: number[], extra: Json = {}) => ({
  title,
  description: `Descrição completa do evento ${title}.`,
  location: "Auditório Central",
  isHidden: false,
  schedule: days.map((d) => ({ date: DaysFromToday(d), startTime: "14:00", endTime: "16:00" })),
  tags: [],
  links: [],
  ...extra,
});

const fair = await call("POST", `/organizations/${orgA.id}/events`, member.token, event("Feira de Ciências", [3, 4], {
  tags: [{ tagId: tech.id, isFreeForm: false }],
  links: [{ labelId: signup.id, url: "https://example.org/inscricao" }],
}));
await call("POST", `/organizations/${orgA.id}/events`, member.token, event("Palestra de IA", [10]));
await call("POST", `/organizations/${orgA.id}/events`, admin.token, event("Semana de Calouros", [1]));
await call("POST", `/organizations/${orgB.id}/events`, outsider.token, event("Evento da Outra Org", [2]));

await call("POST", `/organizations/${orgA.id}/events/${fair.id}/vote`, reporter.token);
await call("POST", `/organizations/${orgA.id}/events/${fair.id}/report`, reporter.token, { reason: "spam", comment: "Parece propaganda" });

await call("POST", "/devices/connect", undefined, { identifier: "orphan-mac-01" });
await call("POST", "/devices/connect", undefined, { identifier: "pending-mac-02", organizationId: orgA.id });
const active = await call("POST", "/devices/connect", undefined, { identifier: "active-mac-03", organizationId: orgA.id });
await call("POST", `/devices/${active.device.id}/approve`, admin.token, { name: "Totem Biblioteca", location: "Biblioteca Central" });
await call("POST", `/devices/${active.device.id}/heartbeat`, active.token, { status: "ok" });
await call("POST", `/devices/${active.device.id}/telemetry`, active.token, {
  cpuTemp: 51.5, memoryUsage: 512 * 1024 * 1024, diskTotal: 32 * 1024 ** 3, diskUsage: 8 * 1024 ** 3,
  osVersion: "Debian 13", kernelVersion: "6.12", puppetVersion: "1.0.0", uptime: 7200,
  hdmiConnected: true, screenOn: true, screenResolution: "1920x1080",
});
await call("POST", `/devices/${active.device.id}/logs`, active.token, { level: "info", message: "Puppet iniciado" });

const state: E2EState = {
  orgA: { id: orgA.id, name: orgA.name },
  orgB: { id: orgB.id, name: orgB.name },
  activeDeviceId: active.device.id,
};
writeFileSync(join(here, ".state.json"), JSON.stringify(state, null, 2));

/** Test-only routes: the email outbox and the seeded ids; `null` for every other path. */
function TestRoute(path: string) {
  if (path === "/__e2e/emails") return io.emailSender.sent;
  if (path === "/__e2e/state") return state;
  return null;
}

/** Reads a Node request body into a buffer (`undefined` when empty). */
async function ReadBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/**
 * The HTTP bridge to the in-process API. Idle keep-alive sockets are kept
 * longer than Next's proxy keeps them: with Node's 5 s default the server could
 * close a socket just as the proxy reused it, and the proxy answered 500
 * (ECONNRESET) to the page.
 */
const bridge = createHttpServer(async (req, res) => {
  const url = `http://localhost:${E2E.apiPort}${req.url}`;
  const image = /^\/__e2e\/images\/([^/.]+)\.webp$/.exec(new URL(url).pathname);
  if (image !== null) {
    const bytes = io.imageStore.assets.get(image[1]);
    res.writeHead(bytes === undefined ? 404 : 200, { "content-type": "image/webp" });
    res.end(bytes === undefined ? undefined : Buffer.from(bytes));
    return;
  }
  const extra = TestRoute(new URL(url).pathname);
  if (extra) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(extra));
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers))
    if (typeof value === "string") headers.set(key, value);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await ReadBody(req);
  const response = await app.handle(new Request(url, { method: req.method, headers, ...(body ? { body } : {}) }));

  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
});
bridge.keepAliveTimeout = 120_000;
bridge.headersTimeout = 121_000;

bridge.listen(E2E.apiPort, () => {
  console.log(`[e2e] API on http://localhost:${E2E.apiPort} (org A ${orgA.id})`);

  const tsconfig = `tsconfig.e2e-${E2E.webPort}.json`;
  writeFileSync(join(here, "..", tsconfig), JSON.stringify({ extends: "./tsconfig.json" }, null, 2));

  // Run Next's CLI with this Node directly: no npx/nubx, and no `.cmd` shims to resolve on Windows.
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const next = spawn(process.execPath, [nextBin, "dev", "-p", String(E2E.webPort)], {
    cwd: join(here, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      PUPPETEER_URL: `http://localhost:${E2E.apiPort}`,
      NEXT_PUBLIC_ORG_ID: orgA.id,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E.webPort}`,
      NEXT_DIST_DIR: `.next/e2e-${E2E.webPort}`,
      NEXT_TSCONFIG_PATH: tsconfig,
    },
  });

  const stop = () => { next.kill("SIGTERM"); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => process.exit(code ?? 1));
});
