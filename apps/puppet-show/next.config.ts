import type { NextConfig } from "next";

/* THE BROWSER TALKS TO /api ON THE SAME ORIGIN, AND NEXT FORWARDS IT TO PUPPETEER (NO CORS NEEDED) */
const PUPPETEER_URL = process.env.PUPPETEER_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  /* THE API'S EMAIL-VERIFICATION LINK LANDS ON /login?emailVerified=..., OUR LOGIN PAGE IS /entrar */
  async redirects() {
    return [{ source: "/login", destination: "/entrar", permanent: false }];
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${PUPPETEER_URL}/:path*` }];
  },
};

export default nextConfig;
