/* e2e/config.ts */

/* SHARED BY THE TEST STACK (server.ts) AND THE PLAYWRIGHT SPECS */

export const E2E = {
  apiPort: 8099,
  webPort: 3100,
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
