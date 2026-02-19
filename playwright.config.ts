import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3005";
const parsedBaseUrl = new URL(baseURL);
const host = parsedBaseUrl.hostname;
const port = parsedBaseUrl.port || (parsedBaseUrl.protocol === "https:" ? "443" : "80");

const authEmail = process.env.E2E_AUTH_EMAIL || "parent@example.com";
const authPassword = process.env.E2E_AUTH_PASSWORD || "LOULOU38";
const authSecret = process.env.E2E_AUTH_SECRET || "e2e-secret-change-me";
const postgresUrl =
  process.env.E2E_POSTGRES_URL || "postgres://postgres:postgres@localhost:5432/babymiam_e2e";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  globalSetup: "./tests/e2e/global.setup.ts",
  globalTeardown: "./tests/e2e/global.teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    viewport: {
      width: 1280,
      height: 900
    },
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: {
    command: `node scripts/e2e/web-server.js --hostname ${host} --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: process.env.CI ? false : true,
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000
    },
    env: {
      ...process.env,
      SKIP_DB_SETUP: "1",
      AUTH_SECRET: authSecret,
      POSTGRES_URL: postgresUrl,
      DATABASE_URL: postgresUrl,
      E2E_AUTH_EMAIL: authEmail,
      E2E_AUTH_PASSWORD: authPassword,
      APP_BASE_URL: baseURL,
      PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES: "60",
      PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS: "2",
      E2E_DIST_DIR: ".next-e2e"
    }
  }
});
