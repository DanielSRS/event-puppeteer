/**
 * Helpers shared by the dashboard-shell specs: reading and following the
 * dashboard navigation on desktop (sidebar) and phones (Menu panel), and
 * switching the Superadmin's context.
 *
 * @module
 */

import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { HasHorizontalScroll, type ViewportName } from "../support.ts";

/** Sections each role sees, in navigation order. */
export const SECTIONS = {
  global: ["Organizações", "Dispositivos Órfãos", "Tags Globais", "Links Globais", "Imagens Escalonadas", "Política de Triagem"],
  admin: ["Meus Eventos", "Denúncias", "Imagens em Revisão", "Usuários Banidos", "Tags Sugeridas", "Auditoria", "Usuários", "Dispositivos", "Configurações"],
  moderator: ["Meus Eventos", "Denúncias", "Imagens em Revisão", "Usuários Banidos", "Tags Sugeridas"],
  member: ["Meus Eventos"],
} as const;

/** The dashboard navigation, opening the Menu panel first on phones. */
export async function OpenNavigation(page: Page, viewport: ViewportName): Promise<Locator> {
  if (viewport === "mobile") {
    await page.getByRole("button", { name: "Seções", exact: true }).click();
    return page.getByRole("dialog", { name: "Menu do painel" }).getByRole("navigation", { name: "Seções do painel" });
  }
  return page.getByRole("navigation", { name: "Seções do painel" });
}

/** Closes the Menu panel on phones (no-op on desktop). */
export async function CloseNavigation(page: Page, viewport: ViewportName): Promise<void> {
  if (viewport !== "mobile") return;
  await page.getByRole("dialog", { name: "Menu do painel" }).getByRole("button", { name: "Fechar" }).click();
}

/** Labels of the section links currently offered. */
export async function SectionLabels(page: Page, viewport: ViewportName): Promise<string[]> {
  const nav = await OpenNavigation(page, viewport);
  await nav.getByRole("link").first().waitFor();
  const labels = (await nav.getByRole("link").allTextContents()).map((text) => text.trim());
  await CloseNavigation(page, viewport);
  return labels;
}

/** Follows the section link `label` and waits for its page to settle. */
export async function OpenSection(page: Page, viewport: ViewportName, label: string): Promise<void> {
  const nav = await OpenNavigation(page, viewport);
  const link = nav.getByRole("link", { name: label, exact: true });
  const href = await link.getAttribute("href");
  if (href === null) throw new Error(`section link ${label} has no href`);
  await link.click();
  await page.waitForURL((url) => url.pathname === href);
  if (viewport === "mobile") await page.getByRole("dialog", { name: "Menu do painel" }).waitFor({ state: "hidden" });
  await page.waitForLoadState("networkidle");
}

/** Picks a context in the Superadmin's switcher (inside the Menu panel on phones). */
export async function SwitchContext(page: Page, viewport: ViewportName, contextName: string): Promise<void> {
  if (viewport === "mobile") await page.getByRole("button", { name: "Seções", exact: true }).click();
  const scope = viewport === "mobile" ? page.getByRole("dialog", { name: "Menu do painel" }) : page.locator("aside");
  await scope.getByRole("button", { name: /Contexto \(trocar\)/ }).click();
  await scope.getByRole("list", { name: "Contextos disponíveis" }).getByRole("button", { name: contextName, exact: true }).click();
  await CloseNavigation(page, viewport);
}

/** The context the header says is being managed. */
export async function ManagedContext(page: Page): Promise<string> {
  const text = await page.getByRole("main").locator("p", { hasText: "Gerenciando:" }).locator("strong").textContent();
  if (text === null) throw new Error("the dashboard header names no context");
  return text;
}

/** Fails when the page scrolls sideways on phones. */
export async function AssertNoSideScroll(page: Page, viewport: ViewportName): Promise<void> {
  if (viewport === "mobile") assert.equal(await HasHorizontalScroll(page), false, `horizontal scroll on ${page.url()}`);
}
