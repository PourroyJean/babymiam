const DEFAULT_LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

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
  const postgresUrl = getEnvValue("POSTGRES_URL", env);
  if (postgresUrl) {
    return { databaseUrl: postgresUrl, source: "POSTGRES_URL", strictRuntime: isStrictRuntime(env) };
  }

  const databaseUrl = getEnvValue("DATABASE_URL", env);
  if (databaseUrl) {
    return { databaseUrl, source: "DATABASE_URL", strictRuntime: isStrictRuntime(env) };
  }

  const strictRuntime = isStrictRuntime(env);

  if (strictRuntime || !allowLocalFallback) {
    const strictReason = strictRuntime ? "NODE_ENV=production ou CI=true" : "script strict";
    throw new Error(
      `[${scriptName}] Missing database URL. Configure POSTGRES_URL or DATABASE_URL (${strictReason}).`
    );
  }

  return {
    databaseUrl: DEFAULT_LOCAL_POSTGRES_URL,
    source: "local-default",
    strictRuntime
  };
}

module.exports = {
  DEFAULT_LOCAL_POSTGRES_URL,
  getEnvValue,
  isStrictRuntime,
  resolveDatabaseUrl
};
