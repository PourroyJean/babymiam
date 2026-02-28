#!/usr/bin/env node

const { Pool } = require("pg");
const argon2 = require("argon2");
const { resolveDatabaseUrl } = require("../db/_db-url");

function parseArgs(argv) {
  const parsed = {
    email: "",
    password: "",
    passwordStdin: false,
    status: "active",
    verifyEmail: false
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

    if (arg === "--password-stdin") {
      parsed.passwordStdin = true;
      continue;
    }

    if (arg === "--status" && next) {
      parsed.status = String(next).trim().toLowerCase();
      i += 1;
      continue;
    }

    if (arg === "--verify-email") {
      parsed.verifyEmail = true;
      continue;
    }
  }

  return parsed;
}

function assertPasswordPolicy(password) {
  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
}

function normalizePasswordFromStdin(rawValue) {
  const value = String(rawValue);
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n")) return value.slice(0, -1);
  return value;
}

async function readPasswordFromStdin() {
  if (process.stdin.isTTY) {
    throw new Error(
      "Aucun mot de passe reçu via stdin. Utilise --password ou pipe une valeur avec --password-stdin."
    );
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  if (chunks.length === 0) {
    throw new Error("Flux stdin vide. Fournis un mot de passe avec --password-stdin.");
  }

  return normalizePasswordFromStdin(Buffer.concat(chunks).toString("utf8"));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email) {
    throw new Error("Argument manquant: --email");
  }

  if (args.passwordStdin && args.password) {
    throw new Error("Utilise soit --password soit --password-stdin, pas les deux.");
  }

  if (!args.passwordStdin && !args.password) {
    throw new Error("Argument manquant: --password (ou --password-stdin).");
  }

  const password = args.passwordStdin ? await readPasswordFromStdin() : args.password;
  assertPasswordPolicy(password);

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "users:create" });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const queryText = args.verifyEmail
      ? `
        INSERT INTO users (email, password_hash, status, email_verified_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          status = EXCLUDED.status,
          email_verified_at = COALESCE(users.email_verified_at, NOW()),
          updated_at = NOW()
        RETURNING id, email, status, email_verified_at::text AS email_verified_at;
      `
      : `
        INSERT INTO users (email, password_hash, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING id, email, status, email_verified_at::text AS email_verified_at;
      `;

    const result = await pool.query(
      queryText,
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
