#!/usr/bin/env node

const { Pool } = require("pg");
const argon2 = require("argon2");
const { resolveDatabaseUrl } = require("../db/_db-url");

function parseArgs(argv) {
  const parsed = {
    email: "",
    password: "",
    status: "active"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--email" && next) {
      parsed.email = String(next).trim().toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--password" && next) {
      parsed.password = String(next);
      i += 1;
      continue;
    }

    if (arg === "--status" && next) {
      parsed.status = String(next).trim().toLowerCase();
      i += 1;
    }
  }

  return parsed;
}

function assertPasswordPolicy(password) {
  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email) {
    throw new Error("Argument manquant: --email");
  }

  if (!args.password) {
    throw new Error("Argument manquant: --password");
  }

  assertPasswordPolicy(args.password);

  const passwordHash = await argon2.hash(args.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "users:create" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(
      `
        INSERT INTO users (email, password_hash, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING id, email, status;
      `,
      [args.email, passwordHash, args.status || "active"]
    );

    console.log("[users:create] User upserted:", result.rows[0]);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("[users:create] Failed:", error);
  process.exit(1);
});
