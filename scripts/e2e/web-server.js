#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const trackedFiles = ["next-env.d.ts", "tsconfig.json"];
const backups = new Map();

function parseArgs(argv) {
  const parsed = {
    hostname: "127.0.0.1",
    port: "3005"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--hostname" && next) {
      parsed.hostname = next;
      i += 1;
      continue;
    }

    if (arg === "--port" && next) {
      parsed.port = next;
      i += 1;
    }
  }

  return parsed;
}

function getNextBinaryPath() {
  const binaryName = process.platform === "win32" ? "next.cmd" : "next";
  return path.join(process.cwd(), "node_modules", ".bin", binaryName);
}

async function backupWorkspaceFiles() {
  for (const relativePath of trackedFiles) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const content = await fs.readFile(absolutePath, "utf8");
    backups.set(absolutePath, content);
  }
}

async function restoreWorkspaceFiles() {
  for (const [absolutePath, content] of backups.entries()) {
    await fs.writeFile(absolutePath, content, "utf8");
  }
}

async function run() {
  const { hostname, port } = parseArgs(process.argv.slice(2));
  await backupWorkspaceFiles();

  const nextBinary = getNextBinaryPath();

  const child = spawn(nextBinary, ["dev", "--hostname", hostname, "--port", port], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  let finalized = false;

  async function finalize(exitCode) {
    if (finalized) return;
    finalized = true;

    try {
      await restoreWorkspaceFiles();
    } catch (error) {
      console.error("[e2e:web-server] Failed to restore workspace files:", error);
    }

    process.exit(exitCode);
  }

  child.on("exit", async (code) => {
    await finalize(code ?? 1);
  });

  child.on("error", async (error) => {
    console.error("[e2e:web-server] Failed to start Next server:", error);
    await finalize(1);
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

run().catch(async (error) => {
  console.error("[e2e:web-server] Fatal error:", error);

  try {
    await restoreWorkspaceFiles();
  } catch {
    // Ignore restore failures on fatal startup errors.
  }

  process.exit(1);
});
