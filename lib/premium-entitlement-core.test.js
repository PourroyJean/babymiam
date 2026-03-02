const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ANTI_FORGET_RADAR_FEATURE,
  hasPremiumFeatureAccess,
  PEDIATRIC_REPORT_FEATURE,
  WEEKLY_DISCOVERY_PLAN_FEATURE
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

test("hasPremiumFeatureAccess supports anti forget feature-specific allowlist", () => {
  const allowed = hasPremiumFeatureAccess(
    { id: 21, email: "radar-premium@example.test" },
    ANTI_FORGET_RADAR_FEATURE,
    {
      NODE_ENV: "production",
      ANTI_FORGET_RADAR_PREMIUM_USER_EMAILS: "radar-premium@example.test"
    }
  );
  const denied = hasPremiumFeatureAccess(
    { id: 22, email: "free@example.test" },
    ANTI_FORGET_RADAR_FEATURE,
    {
      NODE_ENV: "production",
      ANTI_FORGET_RADAR_PREMIUM_USER_EMAILS: "radar-premium@example.test"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test("hasPremiumFeatureAccess supports weekly discovery feature-specific allowlist", () => {
  const allowed = hasPremiumFeatureAccess(
    { id: 33, email: "weekly-premium@example.test" },
    WEEKLY_DISCOVERY_PLAN_FEATURE,
    {
      NODE_ENV: "production",
      WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_EMAILS: "weekly-premium@example.test"
    }
  );
  const denied = hasPremiumFeatureAccess(
    { id: 34, email: "free@example.test" },
    WEEKLY_DISCOVERY_PLAN_FEATURE,
    {
      NODE_ENV: "production",
      WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_EMAILS: "weekly-premium@example.test"
    }
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});
