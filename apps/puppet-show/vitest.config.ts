/**
 * Two test projects:
 * - `unit`: plain functions (`*.test.ts`), run in Node.
 * - `storybook`: every story is a component test (play functions + axe
 *   accessibility checks), run in headless Chromium through Playwright.
 *
 * End-to-end flows against the real API live in `e2e/` and run with
 * `npm run test:e2e` (see e2e/README.md).
 *
 * @see https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
 */

import path from "node:path";

import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: ["node_modules/**", "e2e/**", ".next/**"],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
