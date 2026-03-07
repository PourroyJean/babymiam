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

test("PUBLIC_SHARE_LINK_TTL_DAYS overrides SHARE_SNAPSHOT_TTL_DAYS", () => {
  assert.equal(
    getPublicShareLinkTtlDays({
      PUBLIC_SHARE_LINK_TTL_DAYS: "45",
      SHARE_SNAPSHOT_TTL_DAYS: "30"
    }),
    45
  );
});

test("falls back to SHARE_SNAPSHOT_TTL_DAYS when PUBLIC_SHARE_LINK_TTL_DAYS is absent", () => {
  assert.equal(
    getPublicShareLinkTtlDays({
      SHARE_SNAPSHOT_TTL_DAYS: "90"
    }),
    90
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
