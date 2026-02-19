#!/usr/bin/env node

const { Pool } = require("pg");
const { resolveDatabaseUrl, getEnvValue } = require("./_db-url");

function describeDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname || "unknown-host";
    const dbName = url.pathname.replace(/^\//, "") || "unknown-db";
    return `${host}/${dbName}`;
  } catch {
    return "unknown-target";
  }
}

async function run() {
  if (getEnvValue("SKIP_DB_SETUP") === "1") {
    throw new Error("SKIP_DB_SETUP=1 is active. Disable it before running production DB setup.");
  }

  const { databaseUrl, source } = resolveDatabaseUrl({
    scriptName: "db:preflight",
    allowLocalFallback: false
  });

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query("SELECT 1;");
    const target = describeDatabaseTarget(databaseUrl);
    console.log(`[db:preflight] OK. Env source=${source}. Connectivity validated on ${target}.`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`[db:preflight] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
