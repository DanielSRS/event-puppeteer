/**
 * Runs the end-to-end suite: starts the test stack (`server.ts`: real API on an
 * in-memory database + `next dev`), waits until both answer, runs every
 * `e2e/specs/*.spec.ts` with `node --test`, then stops the stack and exits with
 * the suite's status.
 *
 * Usage (from apps/puppet-show): `npm run test:e2e` — extra arguments are passed
 * to `node --test`, e.g. `npm run test:e2e -- --test-name-pattern=Painel`.
 *
 * @module
 */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E } from "./config.ts";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..");
const apiDir = join(appDir, "..", "puppeteer");

/** Polls `url` until it answers 2xx, or gives up after `timeoutMs`. */
async function WaitFor(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(url).then((response) => response.ok, () => false);
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

const stack = spawn("nub", [join(here, "server.ts")], { cwd: apiDir, stdio: ["ignore", "inherit", "inherit"] });

let finishing = false;

/** Stops the stack and exits with `code`. */
function Finish(code: number): void {
  finishing = true;
  stack.kill("SIGTERM");
  process.exit(code);
}

stack.on("exit", (code) => {
  if (finishing) return;
  console.error(`[e2e] test stack exited early (code ${code})`);
  process.exit(1);
});

const apiUp = await WaitFor(`http://localhost:${E2E.apiPort}/__e2e/state`, 120_000);
const webUp = apiUp && await WaitFor(`http://localhost:${E2E.webPort}/entrar`, 180_000);
if (!webUp) {
  console.error(`[e2e] stack did not come up (api: ${apiUp}, web: ${webUp})`);
  Finish(1);
}

const specs = readdirSync(join(here, "specs"))
  .filter((name) => name.endsWith(".spec.ts"))
  .map((name) => join(here, "specs", name));

const suite = spawn(process.execPath, ["--test", "--test-concurrency=1", ...process.argv.slice(2), ...specs], {
  cwd: appDir,
  stdio: "inherit",
});

suite.on("exit", (code) => Finish(code ?? 1));
