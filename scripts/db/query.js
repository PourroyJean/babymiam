#!/usr/bin/env node

const { Pool } = require("pg");
const { resolveDatabaseUrl } = require("./_db-url");

function parseParamsArg(rawParams) {
  if (typeof rawParams === "undefined") return [];

  let parsed;
  try {
    parsed = JSON.parse(String(rawParams));
  } catch {
    throw new Error(
      "Invalid params JSON. Expected a JSON-encoded array, e.g. '[\"value\",123]'."
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid params value. Expected a JSON array.");
  }

  return parsed;
}

async function run(options = {}) {
  const {
    argv = process.argv,
    createPool = (config) => new Pool(config),
    resolveDb = resolveDatabaseUrl
  } = options;

  const sql = String(argv[2] || "").trim();
  if (!sql) {
    throw new Error("Missing SQL argument. Usage: node scripts/db/query.js \"SELECT ...\" '[params]'");
  }

  const params = parseParamsArg(argv[3]);
  const { databaseUrl } = resolveDb({ scriptName: "db:query" });

  let pool;
  try {
    pool = createPool({ connectionString: databaseUrl });
    const result = await pool.query(sql, params);
    console.log(JSON.stringify(result.rows));
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db:query] Failed: ${message}`);
    process.exit(1);
  });
}

module.exports = {
  parseParamsArg,
  run
};
