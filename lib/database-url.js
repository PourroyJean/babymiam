const DEFAULT_LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function normalizeConnectionString(value) {
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat = parsed.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";

    if (!sslMode || useLibpqCompat) return value;

    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }

    return value;
  } catch {
    return value;
  }
}

function getEnvValue(name, env = process.env) {
  return String(env[name] || "").trim();
}

function isStrictRuntime(env = process.env) {
  const nodeEnv = getEnvValue("NODE_ENV", env).toLowerCase();
  const ci = getEnvValue("CI", env).toLowerCase();
  return nodeEnv === "production" || ci === "true" || ci === "1";
}

function resolveDatabaseUrl({
  scriptName = "db",
  env = process.env,
  allowLocalFallback = true
} = {}) {
  const localPostgresUrl = getEnvValue("LOCAL_POSTGRES_URL", env);
  if (localPostgresUrl && !isStrictRuntime(env)) {
    return {
      databaseUrl: normalizeConnectionString(localPostgresUrl),
      source: "LOCAL_POSTGRES_URL",
      strictRuntime: false
    };
  }

  const postgresUrl = getEnvValue("POSTGRES_URL", env);
  if (postgresUrl) {
    return {
      databaseUrl: normalizeConnectionString(postgresUrl),
      source: "POSTGRES_URL",
      strictRuntime: isStrictRuntime(env)
    };
  }

  const databaseUrl = getEnvValue("DATABASE_URL", env);
  if (databaseUrl) {
    return {
      databaseUrl: normalizeConnectionString(databaseUrl),
      source: "DATABASE_URL",
      strictRuntime: isStrictRuntime(env)
    };
  }

  const strictRuntime = isStrictRuntime(env);

  if (strictRuntime || !allowLocalFallback) {
    const strictReason = strictRuntime ? "NODE_ENV=production ou CI=true" : "script strict";
    throw new Error(
      `[${scriptName}] Missing database URL. Configure POSTGRES_URL or DATABASE_URL (${strictReason}).`
    );
  }

  return {
    databaseUrl: normalizeConnectionString(DEFAULT_LOCAL_POSTGRES_URL),
    source: "local-default",
    strictRuntime
  };
}

module.exports = {
  DEFAULT_LOCAL_POSTGRES_URL,
  getEnvValue,
  isStrictRuntime,
  normalizeConnectionString,
  resolveDatabaseUrl
};
