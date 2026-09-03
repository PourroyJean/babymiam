import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

declare global {
  var __grrrignotePool: Pool | undefined;
}

function getConnectionString() {
  return resolveDatabaseUrl({ scriptName: "db" }).databaseUrl;
}

export function getPool() {
  if (!global.__grrrignotePool) {
    const pool = new Pool({
      connectionString: getConnectionString(),
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    });

    // Prevent idle client errors from crashing the Node process.
    pool.on("error", (error) => {
      console.error("[db] Unexpected error on idle client.", error);
    });

    global.__grrrignotePool = pool;
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
