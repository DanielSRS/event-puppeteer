/**
 * Settings shared by the test stack (`server.ts`), the runner (`run.ts`) and
 * the specs.
 *
 * Ports can be moved with `E2E_API_PORT` / `E2E_WEB_PORT` so several suites
 * can run side by side (each also gets its own Next build dir, see server.ts).
 *
 * @module
 */

/** Reads a port from the environment, or uses `standard` when the variable is unset. */
function Port(name: string, standard: number): number {
  const raw = process.env[name];
  if (raw === undefined) return standard;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`[e2e] ${name}=${raw} is not a valid port`);
    process.exit(1);
  }
  return port;
}

export const E2E = {
  apiPort: Port("E2E_API_PORT", 8099),
  webPort: Port("E2E_WEB_PORT", 3100),
  password: "password123",
  users: {
    superadmin: "super@e2e.test",
    admin: "admin@e2e.test",
    moderator: "moderador@e2e.test",
    member: "membro@e2e.test",
    reporter: "relator@e2e.test",
    outsider: "outro@e2e.test",
  },
} as const;

export type E2EState = {
  orgA: { id: string; name: string };
  orgB: { id: string; name: string };
  activeDeviceId: string;
};
