const test = require("node:test");
const assert = require("node:assert/strict");

const { run } = require("./create-user");

function createFakePool() {
  const calls = [];
  const fakePool = {
    query: async (text, values) => {
      calls.push({ text, values });
      return {
        rowCount: 0,
        rows: [
          {
            id: 1,
            email: values?.[0] ?? "new@example.com",
            status: values?.[2] ?? "active",
            email_verified_at: null
          }
        ]
      };
    },
    end: async () => {}
  };

  return { fakePool, calls };
}

test("run fails fast with --fail-if-exists when account already exists and performs no write", async () => {
  const { fakePool, calls } = createFakePool();
  let hashCalled = false;

  fakePool.query = async (text, values) => {
    calls.push({ text, values });
    return { rowCount: 1, rows: [{ id: 99 }] };
  };

  await assert.rejects(
    run({
      argv: [
        "--email",
        "EXISTING@EXAMPLE.COM",
        "--password",
        "test-password-123",
        "--status",
        "active",
        "--fail-if-exists"
      ],
      createPool: () => fakePool,
      hashPassword: async () => {
        hashCalled = true;
        return "argon2-hash";
      },
      resolveDb: () => ({ databaseUrl: "postgres://example.invalid/db" })
    }),
    /user already exists: existing@example.com/i
  );

  assert.equal(hashCalled, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /SELECT id FROM users WHERE lower\(email\) = lower\(\$1\)/);
  assert.deepEqual(calls[0].values, ["existing@example.com"]);
});

test("run with --fail-if-exists creates user when email is new", async () => {
  const { fakePool, calls } = createFakePool();

  fakePool.query = async (text, values) => {
    calls.push({ text, values });

    if (/SELECT id FROM users/.test(text)) {
      return { rowCount: 0, rows: [] };
    }

    return {
      rowCount: 1,
      rows: [{ id: 2, email: values[0], status: values[2], email_verified_at: null }]
    };
  };

  await run({
    argv: [
      "--email",
      "new@example.com",
      "--password",
      "test-password-123",
      "--status",
      "active",
      "--fail-if-exists"
    ],
    createPool: () => fakePool,
    hashPassword: async () => "argon2-hash",
    resolveDb: () => ({ databaseUrl: "postgres://example.invalid/db" })
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /SELECT id FROM users WHERE lower\(email\) = lower\(\$1\)/);
  assert.match(calls[1].text, /INSERT INTO users/);
  assert.match(calls[1].text, /ON CONFLICT \(email\)/);
});

test("run without --fail-if-exists keeps upsert behavior unchanged", async () => {
  const { fakePool, calls } = createFakePool();

  await run({
    argv: ["--email", "existing@example.com", "--password", "test-password-123", "--status", "active"],
    createPool: () => fakePool,
    hashPassword: async () => "argon2-hash",
    resolveDb: () => ({ databaseUrl: "postgres://example.invalid/db" })
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO users/);
  assert.match(calls[0].text, /ON CONFLICT \(email\)/);
  assert.equal(/SELECT id FROM users/.test(calls[0].text), false);
});
