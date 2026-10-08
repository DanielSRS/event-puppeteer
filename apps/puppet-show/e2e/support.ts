/**
 * Helpers shared by the end-to-end specs.
 *
 * The specs drive the real app (`next dev`) against the real Puppeteer API
 * started by `server.ts`; nothing is simulated. Use {@link Api} to prepare data
 * the way a client would, and {@link OpenPage} + {@link LoginAs} to act as a
 * person.
 *
 * @module
 */

import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";
import { E2E, type E2EState } from "./config.ts";

/** Base URL of the app under test. */
export const WEB = `http://localhost:${E2E.webPort}`;

/** Base URL of the API under test. */
export const API = `http://localhost:${E2E.apiPort}`;

/** Seeded account names, see `server.ts`. */
export type Role = keyof typeof E2E.users;

/** Viewports every flow must work on. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1400, height: 900 } },
  mobile: devices["iPhone 13"],
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

let browser: Browser | null = null;

/** One browser for the whole run; each page gets its own context (own storage). */
async function SharedBrowser(): Promise<Browser> {
  if (browser === null) browser = await chromium.launch();
  return browser;
}

/** Closes the shared browser; call it from an `after` hook. */
export async function CloseBrowser(): Promise<void> {
  if (browser !== null) await browser.close();
  browser = null;
}

/** A fresh page plus the problems seen while it was open. */
export type TestPage = {
  page: Page;
  context: BrowserContext;
  /** Uncaught exceptions and `console.error` lines; specs assert it stays empty. */
  errors: string[];
};

/** Opens a new isolated page in the given viewport and records page errors. */
export async function OpenPage(viewport: ViewportName = "desktop"): Promise<TestPage> {
  const context = await (await SharedBrowser()).newContext({ ...VIEWPORTS[viewport], locale: "pt-BR" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return { page, context, errors };
}

/** Logs in through the real login form and waits for the redirect. */
export async function LoginAs(page: Page, role: Role, redirect = "/"): Promise<void> {
  await page.goto(`${WEB}/entrar?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel("E-mail").fill(E2E.users[role]);
  await page.getByLabel("Senha").fill(E2E.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === redirect);
}

/** Ids seeded by `server.ts`. */
export async function State(): Promise<E2EState> {
  const response = await fetch(`${API}/__e2e/state`);
  return (await response.json()) as E2EState;
}

/** Emails the API "sent" (kept in memory by the test stack). */
export async function Outbox(): Promise<Array<{ to: { email: string }; text: string }>> {
  const response = await fetch(`${API}/__e2e/emails`);
  return (await response.json()) as Array<{ to: { email: string }; text: string }>;
}

/**
 * Calls the API as a seeded account (or anonymously), for test setup and for
 * checking what the UI did. Fails the test on any non-2xx answer.
 */
export async function Api(role: Role | null, method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (role !== null) headers.authorization = `Bearer ${await TokenFor(role)}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const tokens = new Map<Role, string>();

/** Session token of a seeded account (logs in once per run). */
async function TokenFor(role: Role): Promise<string> {
  const cached = tokens.get(role);
  if (cached !== undefined) return cached;

  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: E2E.users[role], password: E2E.password }),
  });
  if (!response.ok) throw new Error(`login ${role} -> ${response.status}`);
  const { token } = (await response.json()) as { token: string };
  tokens.set(role, token);
  return token;
}

/** `YYYY-MM-DD`, `days` from today (UTC, like the API). */
export function DaysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Creates an event through the API as `role` and returns its id. */
export async function CreateEvent(role: Role, orgId: string, title: string, extra: Record<string, unknown> = {}): Promise<string> {
  const created = await Api(role, "POST", `/organizations/${orgId}/events`, {
    title,
    description: `Descrição do evento ${title}.`,
    location: "Auditório Central",
    isHidden: false,
    schedule: [{ date: DaysFromToday(2), startTime: "09:00" }],
    tags: [],
    links: [],
    ...extra,
  });
  return (created as { id: string }).id;
}

/** True when the page scrolls sideways (a responsive-layout bug). */
export async function HasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
