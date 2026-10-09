/**
 * Next.js configuration.
 *
 * The browser talks to `/api` on the same origin and Next forwards it to
 * Puppeteer (`PUPPETEER_URL`), so no CORS is needed. `PUPPETEER_URL` is
 * required: without it the build stops with an explanation instead of
 * proxying somewhere unintended.
 *
 * `NEXT_DIST_DIR` and `NEXT_TSCONFIG_PATH` are only set by the end-to-end
 * stack (e2e/server.ts): parallel test stacks get their own build directory,
 * and `next dev` records that directory in a generated tsconfig instead of
 * rewriting the project's tsconfig.json.
 *
 * @module
 */

import type { NextConfig } from "next";

const PUPPETEER_URL = process.env.PUPPETEER_URL;

if (!PUPPETEER_URL) {
  console.error("PUPPETEER_URL não definida. Defina a URL da API Puppeteer (veja .env.example).");
  process.exit(1);
}

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(process.env.NEXT_TSCONFIG_PATH ? { typescript: { tsconfigPath: process.env.NEXT_TSCONFIG_PATH } } : {}),

  /** The API's email-verification link lands on /login?emailVerified=…; our login page is /entrar. */
  async redirects() {
    return [{ source: "/login", destination: "/entrar", permanent: false }];
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${PUPPETEER_URL}/:path*` }];
  },
};

export default nextConfig;
