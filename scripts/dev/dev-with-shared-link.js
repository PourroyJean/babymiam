#!/usr/bin/env node

const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { loadEnvConfig } = require("@next/env");

function getNextBinaryPath() {
  const binaryName = process.platform === "win32" ? "next.cmd" : "next";
  return path.join(process.cwd(), "node_modules", ".bin", binaryName);
}

function parseDevArgs(argv) {
  let hostname = "localhost";
  let port = "3000";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    const next = String(argv[i + 1] || "");
    if (arg.startsWith("--hostname=")) {
      hostname = String(arg.split("=")[1] || "").trim() || hostname;
      continue;
    }
    if (arg.startsWith("--port=")) {
      port = String(arg.split("=")[1] || "").trim() || port;
      continue;
    }
    if ((arg === "--hostname" || arg === "-H") && next) {
      hostname = next;
      i += 1;
      continue;
    }
    if ((arg === "--port" || arg === "-p") && next) {
      port = next;
      i += 1;
      continue;
    }
  }

  return { hostname, port };
}

function normalizeHostnameForUrl(hostname) {
  if (!hostname || hostname === "0.0.0.0" || hostname === "::") return "127.0.0.1";
  return hostname;
}

function setDevAppBaseUrlFromArgs(argv) {
  const { hostname, port } = parseDevArgs(argv);
  const normalizedHost = normalizeHostnameForUrl(hostname);
  process.env.APP_BASE_URL = `http://${normalizedHost}:${port}`;
}

function hydrateLocalEnvForDev() {
  loadEnvConfig(process.cwd(), true);
}

function runSharedTestLinkGeneration() {
  const scriptPath = path.resolve(__dirname, "../users/test-link-generate.js");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.warn(
      `[dev:shared-test-link] Skip shared test link generation (${result.error.message}). Continuing with next dev.`
    );
    return;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    console.warn(
      `[dev:shared-test-link] Shared test link generation exited with code ${result.status}. Continuing with next dev.`
    );
  }
}

function run() {
  hydrateLocalEnvForDev();
  setDevAppBaseUrlFromArgs(process.argv.slice(2));
  runSharedTestLinkGeneration();

  const nextBinary = getNextBinaryPath();
  const child = spawn(nextBinary, ["dev", ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  child.on("error", (error) => {
    console.error(`[dev:shared-test-link] Failed to start next dev: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  process.on("SIGTERM", () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  });

  process.on("SIGINT", () => {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  });
}

run();
