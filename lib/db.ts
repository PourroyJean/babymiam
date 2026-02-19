import { Pool } from "pg";

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function getEnvValue(name: string) {
  return String(process.env[name] || "").trim();
}

function isStrictRuntime() {
  const nodeEnv = getEnvValue("NODE_ENV").toLowerCase();
  const ci = getEnvValue("CI").toLowerCase();
  return nodeEnv === "production" || ci === "true" || ci === "1";
}

function normalizeConnectionString(value: string) {
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat = parsed.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";

    if (!sslMode || useLibpqCompat) return value;

    // pg currently treats these sslmodes like verify-full and warns that behavior will change in v9.
    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }

    return value;
  } catch {
    return value;
  }
}

declare global {
  var __grrrignotePool: Pool | undefined;
}

function getConnectionString() {
  const postgresUrl = getEnvValue("POSTGRES_URL");
  if (postgresUrl) return normalizeConnectionString(postgresUrl);

  const databaseUrl = getEnvValue("DATABASE_URL");
  if (databaseUrl) return normalizeConnectionString(databaseUrl);

  if (isStrictRuntime()) {
    throw new Error("[db] Missing database URL. Configure POSTGRES_URL or DATABASE_URL.");
  }

  const raw = LOCAL_POSTGRES_URL;
  return normalizeConnectionString(raw);
}

export function getPool() {
  if (!global.__grrrignotePool) {
    global.__grrrignotePool = new Pool({
      connectionString: getConnectionString(),
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    });
  }

  return global.__grrrignotePool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = []
) {
  const pool = getPool();
  return pool.query<T>(text, values);
}
