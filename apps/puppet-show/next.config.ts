/**
 * Next.js configuration.
 *
 * The browser talks to `/api` on the same origin and Next forwards it to
 * Puppeteer (`PUPPETEER_URL`), so no CORS is needed. `PUPPETEER_URL` is
 * required: without it the build stops with an explanation instead of
 * proxying somewhere unintended.
 *
 * `NEXT_DIST_DIR` is only set by the end-to-end runner, so parallel test stacks
 * don't share a build directory.
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

  /** The API's email-verification link lands on /login?emailVerified=…; our login page is /entrar. */
  async redirects() {
    return [{ source: "/login", destination: "/entrar", permanent: false }];
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${PUPPETEER_URL}/:path*` }];
  },
};

export default nextConfig;
