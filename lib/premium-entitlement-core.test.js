const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasPremiumFeatureAccess,
  PEDIATRIC_REPORT_FEATURE
} = require("./premium-entitlement-core");

test("hasPremiumFeatureAccess bypasses checks when premium gate is off", () => {
  const allowed = hasPremiumFeatureAccess(
    { id: 42, email: "nobody@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      PREMIUM_GATE_MODE: "off",
      NODE_ENV: "production"
    }
  );

  assert.equal(allowed, true);
});

test("hasPremiumFeatureAccess uses feature email allowlist in production", () => {
  const allowed = hasPremiumFeatureAccess(
    { id: 1, email: "premium@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production",
      PEDIATRIC_REPORT_PREMIUM_USER_EMAILS: "premium@example.test"
    }
  );
  const denied = hasPremiumFeatureAccess(
    { id: 2, email: "free@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production",
      PEDIATRIC_REPORT_PREMIUM_USER_EMAILS: "premium@example.test"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("hasPremiumFeatureAccess accepts configured premium user id in production", () => {
  const allowed = hasPremiumFeatureAccess(
    { id: 7, email: "free@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production",
      PEDIATRIC_REPORT_PREMIUM_USER_IDS: "7,8"
    }
  );
  const denied = hasPremiumFeatureAccess(
    { id: 9, email: "free@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production",
      PEDIATRIC_REPORT_PREMIUM_USER_IDS: "7,8"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("hasPremiumFeatureAccess keeps personal access fallback in production", () => {
  const defaultPersonalAllowed = hasPremiumFeatureAccess(
    { id: 10, email: "ljcls@gmail.com" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production"
    }
  );

  const canonicalPersonalAllowed = hasPremiumFeatureAccess(
    { id: 11, email: "owner@example.test" },
    PEDIATRIC_REPORT_FEATURE,
    {
      NODE_ENV: "production",
      PERSONAL_ACCESS_EMAIL: "owner@example.test"
    }
  );

  assert.equal(defaultPersonalAllowed, true);
  assert.equal(canonicalPersonalAllowed, true);
});
