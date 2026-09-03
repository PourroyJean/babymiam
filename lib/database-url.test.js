const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_LOCAL_POSTGRES_URL,
  normalizeConnectionString,
  resolveDatabaseUrl
} = require("./database-url");

test("prefers LOCAL_POSTGRES_URL outside strict runtimes", () => {
  const result = resolveDatabaseUrl({
    env: {
      LOCAL_POSTGRES_URL: "postgres://local/database",
      POSTGRES_URL: "postgres://postgres/database",
      DATABASE_URL: "postgres://database/database"
    }
  });

  assert.equal(result.databaseUrl, "postgres://local/database");
  assert.equal(result.source, "LOCAL_POSTGRES_URL");
  assert.equal(result.strictRuntime, false);
});

test("prefers POSTGRES_URL over DATABASE_URL", () => {
  const result = resolveDatabaseUrl({
    env: {
      POSTGRES_URL: "postgres://postgres/database",
      DATABASE_URL: "postgres://database/database"
    }
  });

  assert.equal(result.databaseUrl, "postgres://postgres/database");
  assert.equal(result.source, "POSTGRES_URL");
});

test("ignores LOCAL_POSTGRES_URL in production and CI", () => {
  for (const env of [
    { NODE_ENV: "production", LOCAL_POSTGRES_URL: "postgres://local/database", POSTGRES_URL: "postgres://postgres/database" },
    { CI: "true", LOCAL_POSTGRES_URL: "postgres://local/database", POSTGRES_URL: "postgres://postgres/database" }
  ]) {
    const result = resolveDatabaseUrl({ env });
    assert.equal(result.databaseUrl, "postgres://postgres/database");
    assert.equal(result.source, "POSTGRES_URL");
    assert.equal(result.strictRuntime, true);
  }
});

test("rejects a missing URL in a strict runtime", () => {
  assert.throws(
    () => resolveDatabaseUrl({ scriptName: "test", env: { NODE_ENV: "production" } }),
    /\[test\] Missing database URL/
  );
});

test("rejects a missing URL when local fallback is disabled", () => {
  assert.throws(
    () => resolveDatabaseUrl({ scriptName: "preflight", env: {}, allowLocalFallback: false }),
    /\[preflight\] Missing database URL/
  );
});

test("uses the documented local fallback outside strict runtimes", () => {
  const result = resolveDatabaseUrl({ env: {} });
  assert.equal(result.databaseUrl, DEFAULT_LOCAL_POSTGRES_URL);
  assert.equal(result.source, "local-default");
  assert.equal(result.strictRuntime, false);
});

test("normalizes pg ssl modes that will change behavior", () => {
  assert.equal(
    normalizeConnectionString("postgres://user:password@example.test/db?sslmode=require"),
    "postgres://user:password@example.test/db?sslmode=verify-full"
  );
});

test("preserves sslmode with explicit libpq compatibility", () => {
  const url = "postgres://user:password@example.test/db?sslmode=require&uselibpqcompat=true";
  assert.equal(normalizeConnectionString(url), url);
});
