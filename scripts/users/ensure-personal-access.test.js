const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_PERSONAL_ACCESS_EMAIL,
  ensurePersonalAccess,
  resolvePersonalAccessCredentials
} = require("./ensure-personal-access");

test("resolvePersonalAccessCredentials rejects invalid email", () => {
  assert.throws(
    () =>
      resolvePersonalAccessCredentials({
        PERSONAL_ACCESS_EMAIL: "LJCLS",
        PERSONAL_ACCESS_PASSWORD: "test-password-123"
      }),
    /Invalid email format/
  );
});

test("resolvePersonalAccessCredentials fails when only removed legacy variables are provided", () => {
  const legacyEmailKey = ["AUTH", "USER"].join("_");
  const legacyPasswordKey = ["AUTH", "PASSWORD"].join("_");

  assert.throws(
    () =>
      resolvePersonalAccessCredentials({
        [legacyEmailKey]: "ljcls@gmail.com",
        [legacyPasswordKey]: "test-password-123"
      }),
    /Missing credentials/
  );
});

test("resolvePersonalAccessCredentials normalizes uppercase email", () => {
  const result = resolvePersonalAccessCredentials({
    PERSONAL_ACCESS_EMAIL: "LJCLS@GMAIL.COM",
    PERSONAL_ACCESS_PASSWORD: "test-password-123"
  });

  assert.equal(result.email, "ljcls@gmail.com");
  assert.equal(result.password, "test-password-123");
});

test("resolvePersonalAccessCredentials fails in production when missing credentials", () => {
  assert.throws(
    () =>
      resolvePersonalAccessCredentials({
        NODE_ENV: "production"
      }),
    /Missing credentials/
  );
});

test("ensurePersonalAccess is idempotent across repeated runs", async () => {
  const queries = [];
  const fakePool = {
    query: async (text, values) => {
      queries.push({ text, values });
      return {
        rows: [
          {
            id: 42,
            email: values[0],
            status: "active",
            email_verified_at: "2026-02-25T00:00:00.000Z"
          }
        ]
      };
    },
    end: async () => {}
  };

  const createPool = () => fakePool;
  const hashPassword = async () => "argon2-hash";
  const env = {
    PERSONAL_ACCESS_EMAIL: "LJCLS@GMAIL.COM",
    PERSONAL_ACCESS_PASSWORD: "test-password-123"
  };

  await ensurePersonalAccess({
    env,
    databaseUrl: "postgres://example.invalid/db",
    createPool,
    hashPassword
  });

  await ensurePersonalAccess({
    env,
    databaseUrl: "postgres://example.invalid/db",
    createPool,
    hashPassword
  });

  assert.equal(queries.length, 2);
  assert.equal(queries[0].values[0], DEFAULT_PERSONAL_ACCESS_EMAIL);
  assert.equal(queries[1].values[0], DEFAULT_PERSONAL_ACCESS_EMAIL);
  assert.match(queries[0].text, /ON CONFLICT \(email\)/);
  assert.match(queries[1].text, /ON CONFLICT \(email\)/);
});
