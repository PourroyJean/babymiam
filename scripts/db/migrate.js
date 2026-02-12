#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || LOCAL_POSTGRES_URL;
}

async function runMigrations() {
  if (process.env.SKIP_DB_SETUP === "1") {
    console.log("[db:migrate] Skipped (SKIP_DB_SETUP=1).");
    return;
  }

  const migrationPath = path.join(process.cwd(), "scripts", "db", "migrate.sql");
  const migrationSql = await fs.readFile(migrationPath, "utf8");

  const pool = new Pool({
    connectionString: getConnectionString()
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query("COMMIT");
    console.log("[db:migrate] Migrations applied.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("[db:migrate] Failed:", error);
  process.exit(1);
});
