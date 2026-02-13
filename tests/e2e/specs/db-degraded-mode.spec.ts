import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "../fixtures/test-fixtures";

const DEGRADED_BASE_URL = process.env.E2E_DEGRADED_BASE_URL || "http://127.0.0.1:3101";
const DEGRADED_PORT = new URL(DEGRADED_BASE_URL).port || "3101";
const AUTH_USER = process.env.E2E_AUTH_USER || "LJCLS";
const AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";
const AUTH_SECRET = process.env.E2E_AUTH_SECRET || "e2e-secret-change-me";
const BAD_POSTGRES_URL = "postgres://postgres:postgres@127.0.0.1:65432/broken_db";

let degradedServer: ChildProcessWithoutNullStreams | null = null;
let degradedLogs = "";

async function waitForDegradedServerReady(baseUrl: string, timeoutMs: number) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Server not ready yet.
    }

    await sleep(500);
  }

  throw new Error(
    `Serveur dégradé indisponible après ${timeoutMs}ms. Derniers logs:\n${degradedLogs.slice(-4000)}`
  );
}

async function stopDegradedServer() {
  if (!degradedServer || degradedServer.killed) return;

  await new Promise<void>((resolve) => {
    const processRef = degradedServer;

    const timer = setTimeout(() => {
      processRef.kill("SIGKILL");
      resolve();
    }, 10_000);

    processRef.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    processRef.kill("SIGTERM");
  });

  degradedServer = null;
}

test.describe("db degraded mode", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(150_000);
    degradedLogs = "";

    degradedServer = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", DEGRADED_PORT],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SKIP_DB_SETUP: "1",
          AUTH_USER,
          AUTH_PASSWORD,
          AUTH_SECRET,
          POSTGRES_URL: BAD_POSTGRES_URL,
          DATABASE_URL: BAD_POSTGRES_URL,
          E2E_DIST_DIR: ".next-e2e-degraded"
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    degradedServer.stdout.on("data", (chunk: Buffer) => {
      degradedLogs += chunk.toString();
      if (degradedLogs.length > 20_000) {
        degradedLogs = degradedLogs.slice(-20_000);
      }
    });

    degradedServer.stderr.on("data", (chunk: Buffer) => {
      degradedLogs += chunk.toString();
      if (degradedLogs.length > 20_000) {
        degradedLogs = degradedLogs.slice(-20_000);
      }
    });

    await waitForDegradedServerReady(DEGRADED_BASE_URL, 90_000);
  });

  test.afterAll(async () => {
    await stopDegradedServer();
  });

  test("shows degraded warnings on protected pages after login", async ({ page }) => {
    await page.goto(`${DEGRADED_BASE_URL}/login`);

    await page.getByLabel("Identifiant").fill(AUTH_USER);
    await page.getByLabel("Mot de passe").fill(AUTH_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("heading", { name: "Base locale non disponible" })).toBeVisible();

    await page.goto(`${DEGRADED_BASE_URL}/blog`);
    await expect(page.getByRole("heading", { name: "Profil enfant non disponible" })).toBeVisible();
  });

  test("keeps login and public share pages accessible while DB is down", async ({ page }) => {
    await page.goto(`${DEGRADED_BASE_URL}/share?sid=share_87654321&i=4&t=10&l=2`);
    await expect(page.getByRole("heading", { name: /Progression diversification|Les progres/i })).toBeVisible();

    await page.goto(`${DEGRADED_BASE_URL}/login`);
    await expect(page.getByRole("heading", { name: "Grrrignote" })).toBeVisible();
  });
});
