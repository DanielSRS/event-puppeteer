/**
 * Helpers shared by the dashboard admin-pages specs: people created for a
 * test (registered through the real flow), API calls with their own token,
 * and opening an admin page and waiting for its data.
 *
 * @module
 */

import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { E2E } from "../config.ts";
import { API, HasHorizontalScroll, Outbox, WEB, type TestPage } from "../support.ts";

/** A person registered by a test. */
export type Person = { id: string; email: string; token: string };

/** Calls the API with a session token; fails the test on a non-2xx answer. */
export async function CallAs(token: string | null, method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token !== null) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${API}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Status of a login attempt with the e2e password (200 = it worked). */
export async function LoginStatus(email: string): Promise<number> {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: E2E.password }),
  });
  return response.status;
}

/** Registers a Member of `orgId` through the real flow (sign-up, emailed link, login). */
export async function RegisterPerson(orgId: string, firstName: string, lastName: string, email: string): Promise<Person> {
  const { user } = await CallAs(null, "POST", `/auth/register?orgId=${orgId}`, { firstName, lastName, email, password: E2E.password }) as { user: { id: string } };
  const message = (await Outbox()).findLast((m) => m.to.email === email);
  const link = message?.text.match(/https?:\/\/\S+verify-email\?token=\S+/)?.[0];
  if (link === undefined) throw new Error(`no verification email for ${email}`);
  await fetch(link.replace(/^https?:\/\/[^/]+/, API), { redirect: "manual" });
  const { token } = await CallAs(null, "POST", "/auth/login", { email, password: E2E.password }) as { token: string };
  return { id: user.id, email, token };
}

/** Goes to an admin page and waits for its heading and for the data to load. */
export async function OpenAdminPage(page: Page, path: string, heading: string): Promise<Locator> {
  await page.goto(`${WEB}${path}`);
  const main = page.getByRole("main");
  await main.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor();
  await page.waitForLoadState("networkidle");
  await main.locator("[aria-busy=true]").first().waitFor({ state: "detached" });
  return main;
}

/** The card (list item) whose heading is `name`. */
export function CardOf(scope: Locator, name: string): Locator {
  return scope.getByRole("listitem").filter({ has: scope.page().getByRole("heading", { name, exact: true }) });
}

/**
 * Asserts the page recorded exactly the `expected` errors (none by default; the
 * browser logs every refused request, e.g. a 409 the page handles) and, on
 * phones, no sideways scroll; then closes it.
 */
export async function Finish({ page, context, errors }: TestPage, mobile: boolean, expected: string[] = []): Promise<void> {
  if (mobile) assert.equal(await HasHorizontalScroll(page), false, `horizontal scroll on ${page.url()}`);
  assert.deepEqual(errors, expected);
  await context.close();
}

/** The console line Chromium writes for a request the server refused with `status`. */
export function RefusedRequest(status: number, text: string): string {
  return `console: Failed to load resource: the server responded with a status of ${status} (${text})`;
}

/** Every admin route; compiled ahead so `next dev` compiling a route doesn't eat a test's time. */
export const ADMIN_PATHS = [
  "/dashboard/reports", "/dashboard/images", "/dashboard/bans", "/dashboard/tags", "/dashboard/audit", "/dashboard/users",
  "/dashboard/devices", "/dashboard/settings", "/dashboard/global/orgs", "/dashboard/global/devices",
  "/dashboard/global/tags", "/dashboard/global/links", "/dashboard/global/images", "/dashboard/global/screening",
];

/** Requests each route once so the dev server compiles it before the tests time it. */
export async function WarmUp(paths: readonly string[]): Promise<void> {
  for (const path of paths) await fetch(`${WEB}${path}`);
}
