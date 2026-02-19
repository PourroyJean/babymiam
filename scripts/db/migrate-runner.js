#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { resolveDatabaseUrl, getEnvValue, isStrictRuntime } = require("./_db-url");

const SUPPORTED_COMMANDS = new Set(["up", "down", "create"]);

function printUsage() {
  console.error("Usage: node scripts/db/migrate-runner.js <up|down|create> [args]");
  console.error("Examples:");
  console.error("  node scripts/db/migrate-runner.js up");
  console.error("  node scripts/db/migrate-runner.js down 1");
  console.error("  node scripts/db/migrate-runner.js create add-food-index");
}

function hasHelpArg(args) {
  return args.includes("--help") || args.includes("-h");
}

function hasMigrationNameArg(args) {
  return args.some((arg) => !arg.startsWith("-"));
}

function shouldSkipUpMigrations() {
  const skipDbSetup = getEnvValue("SKIP_DB_SETUP");
  if (skipDbSetup !== "1") return false;

  if (isStrictRuntime()) {
    console.error(
      "[db:migrate] Refusing to skip migrations in production/CI. Remove SKIP_DB_SETUP=1."
    );
    process.exit(1);
  }

  if (getEnvValue("ALLOW_MIGRATE_SKIP") === "1") {
    console.log("[db:migrate] Skipped (SKIP_DB_SETUP=1 and ALLOW_MIGRATE_SKIP=1).");
    return true;
  }

  console.error(
    "[db:migrate] SKIP_DB_SETUP=1 detected. Refusing manual migration. Unset SKIP_DB_SETUP or set ALLOW_MIGRATE_SKIP=1 explicitly."
  );
  process.exit(1);
}

const command = process.argv[2];
const passthroughArgs = process.argv.slice(3);

if (!command || !SUPPORTED_COMMANDS.has(command)) {
  printUsage();
  process.exit(1);
}

if (command === "up" && shouldSkipUpMigrations()) {
  process.exit(0);
}

if (command === "create" && !hasHelpArg(passthroughArgs) && !hasMigrationNameArg(passthroughArgs)) {
  console.error("[db:migrate] Missing migration name for create command.");
  printUsage();
  process.exit(1);
}

const cliPath = path.resolve(__dirname, "../../node_modules/node-pg-migrate/bin/node-pg-migrate.js");
const migrationsDir = path.resolve(__dirname, "../../migrations");

if (!fs.existsSync(cliPath)) {
  console.error(`[db:migrate] node-pg-migrate CLI not found at ${cliPath}`);
  console.error("[db:migrate] Run `npm install` before using migrations.");
  process.exit(1);
}

const cliArgs = [command, ...passthroughArgs, "--migrations-dir", migrationsDir];
if (command === "create") {
  cliArgs.push("--migration-file-language", "sql");
}

const runnerEnv = { ...process.env };
if (command !== "create") {
  try {
    const resolved = resolveDatabaseUrl({ scriptName: "db:migrate" });
    runnerEnv.DATABASE_URL = resolved.databaseUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.startsWith("[db:migrate]") ? message : `[db:migrate] ${message}`);
    process.exit(1);
  }
}

try {
  execFileSync(process.execPath, [cliPath, ...cliArgs], {
    stdio: "inherit",
    env: runnerEnv
  });
} catch (error) {
  const printableArgs = cliArgs.map((arg) => JSON.stringify(arg)).join(" ");
  console.error(`[db:migrate] Failed command: node ${JSON.stringify(cliPath)} ${printableArgs}`);
  if (typeof error?.status === "number") {
    console.error(`[db:migrate] Exit code: ${error.status}`);
  }
  console.error(`[db:migrate] Cause: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(typeof error?.status === "number" ? error.status : 1);
}
