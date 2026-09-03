const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPublicShareToken,
  DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS,
  getPublicShareLinkExpiresAtEpochSeconds,
  getPublicShareLinkTtlDays,
  isPublicShareLinkExpired,
  verifyPublicShareToken
} = require("./public-share-token");

test("createPublicShareToken signs and verifyPublicShareToken validates the token", () => {
  const token = createPublicShareToken({
    publicId: "public_share_1234567890",
    issuedAtEpochSeconds: 1_772_800_000,
    secret: "secret-a"
  });

  const verified = verifyPublicShareToken({
    token,
    secrets: ["secret-b", "secret-a"]
  });

  assert.deepEqual(verified, {
    publicId: "public_share_1234567890",
    issuedAtEpochSeconds: 1_772_800_000
  });
});

test("default TTL is 180 days", () => {
  assert.equal(getPublicShareLinkTtlDays({}), DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS);
  assert.equal(DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS, 180);
});

test("ignores the removed legacy TTL setting", () => {
  const retiredSetting = ["SHARE", "SNAPSHOT", "TTL", "DAYS"].join("_");

  assert.equal(
    getPublicShareLinkTtlDays({
      [retiredSetting]: "90"
    }),
    DEFAULT_PUBLIC_SHARE_LINK_TTL_DAYS
  );
});

test("isPublicShareLinkExpired uses the configured TTL when explicit expiry is absent", () => {
  const issuedAtEpochSeconds = 1_772_800_000;
  const expiresAtEpochSeconds = getPublicShareLinkExpiresAtEpochSeconds(issuedAtEpochSeconds, {
    PUBLIC_SHARE_LINK_TTL_DAYS: "180"
  });

  assert.equal(
    isPublicShareLinkExpired({
      issuedAtEpochSeconds,
      nowEpochSeconds: issuedAtEpochSeconds + (179 * 24 * 60 * 60),
      env: { PUBLIC_SHARE_LINK_TTL_DAYS: "180" }
    }),
    false
  );

  assert.equal(
    isPublicShareLinkExpired({
      issuedAtEpochSeconds,
      expiresAtEpochSeconds,
      nowEpochSeconds: issuedAtEpochSeconds + (180 * 24 * 60 * 60),
      env: { PUBLIC_SHARE_LINK_TTL_DAYS: "180" }
    }),
    true
  );
});
