const test = require("node:test");
const assert = require("node:assert/strict");

const { hasPremiumAccess } = require("./premium-entitlement-core");

test("hasPremiumAccess bypasses checks when premium gate is off", () => {
  const allowed = hasPremiumAccess(
    { id: 42, email: "nobody@example.test" },
    {
      PREMIUM_GATE_MODE: "off",
      NODE_ENV: "production"
    }
  );

  assert.equal(allowed, true);
});

test("hasPremiumAccess uses global email allowlist in production", () => {
  const allowed = hasPremiumAccess(
    { id: 1, email: "premium@example.test" },
    {
      NODE_ENV: "production",
      PREMIUM_FEATURE_USER_EMAILS: "premium@example.test"
    }
  );
  const denied = hasPremiumAccess(
    { id: 2, email: "free@example.test" },
    {
      NODE_ENV: "production",
      PREMIUM_FEATURE_USER_EMAILS: "premium@example.test"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("hasPremiumAccess accepts configured premium user id in production", () => {
  const allowed = hasPremiumAccess(
    { id: 7, email: "free@example.test" },
    {
      NODE_ENV: "production",
      PREMIUM_FEATURE_USER_IDS: "7,8"
    }
  );
  const denied = hasPremiumAccess(
    { id: 9, email: "free@example.test" },
    {
      NODE_ENV: "production",
      PREMIUM_FEATURE_USER_IDS: "7,8"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("hasPremiumAccess keeps personal access fallback in production", () => {
  const defaultPersonalAllowed = hasPremiumAccess(
    { id: 10, email: "ljcls@gmail.com" },
    {
      NODE_ENV: "production"
    }
  );

  const canonicalPersonalAllowed = hasPremiumAccess(
    { id: 11, email: "owner@example.test" },
    {
      NODE_ENV: "production",
      PERSONAL_ACCESS_EMAIL: "owner@example.test"
    }
  );

  assert.equal(defaultPersonalAllowed, true);
  assert.equal(canonicalPersonalAllowed, true);
});

test("hasPremiumAccess denies non-premium users when gating is enforced", () => {
  const denied = hasPremiumAccess(
    { id: 12, email: "blocked@example.test" },
    {
      NODE_ENV: "production",
      PREMIUM_FEATURE_USER_EMAILS: "premium@example.test",
      PREMIUM_FEATURE_USER_IDS: "7,8"
    }
  );

  assert.equal(denied, false);
});
