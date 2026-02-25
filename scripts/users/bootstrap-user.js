#!/usr/bin/env node

const path = require("node:path");
const { execFileSync } = require("node:child_process");

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function shouldVerifyEmail() {
  const raw = getEnv("DB_SETUP_BOOTSTRAP_VERIFY_EMAIL").toLowerCase();
  if (!raw) return true;
  return !(raw === "0" || raw === "false" || raw === "no");
}

function resolveBootstrapCredentials() {
  const email = getEnv("DB_SETUP_BOOTSTRAP_EMAIL").toLowerCase();
  const password = getEnv("DB_SETUP_BOOTSTRAP_PASSWORD");

  if (!email && !password) {
    console.log("[db:setup] Bootstrap user skipped (no DB_SETUP_BOOTSTRAP_EMAIL/DB_SETUP_BOOTSTRAP_PASSWORD).");
    return null;
  }

  if ((email && !password) || (!email && password)) {
    throw new Error(
      "[db:setup] DB_SETUP_BOOTSTRAP_EMAIL et DB_SETUP_BOOTSTRAP_PASSWORD doivent etre definies ensemble."
    );
  }

  return { email, password };
}

function run() {
  const credentials = resolveBootstrapCredentials();
  if (!credentials) {
    return;
  }

  const { email, password } = credentials;
  const status = getEnv("DB_SETUP_BOOTSTRAP_STATUS") || "active";
  const createUserScriptPath = path.join(__dirname, "create-user.js");
  const args = [createUserScriptPath, "--email", email, "--password", password, "--status", status];

  if (shouldVerifyEmail()) {
    args.push("--verify-email");
  }

  execFileSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env
  });
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:setup] Bootstrap user creation failed: ${message}`);
  process.exit(1);
}
