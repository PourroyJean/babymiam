#!/usr/bin/env node

const { Pool } = require("pg");
const argon2 = require("argon2");

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const LEGACY_ADMIN_EMAIL = getRequiredEnv("LEGACY_ADMIN_EMAIL").toLowerCase();
const LEGACY_ADMIN_PASSWORD = getRequiredEnv("LEGACY_ADMIN_PASSWORD");

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || LOCAL_POSTGRES_URL;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function validateAdminCredentials() {
  if (!LEGACY_ADMIN_EMAIL.includes("@")) {
    throw new Error("LEGACY_ADMIN_EMAIL must be a valid email address.");
  }

  if (LEGACY_ADMIN_PASSWORD.length < 8) {
    throw new Error("LEGACY_ADMIN_PASSWORD must contain at least 8 characters.");
  }
}

async function hasColumn(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1;
    `,
    [tableName, columnName]
  );

  return result.rowCount > 0;
}

async function ensureAdminUser(client) {
  const passwordHash = await argon2.hash(LEGACY_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  const result = await client.query(
    `
      INSERT INTO users (email, password_hash, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING id;
    `,
    [LEGACY_ADMIN_EMAIL, passwordHash]
  );

  return Number(result.rows[0]?.id);
}

async function assignLegacyOwners(client, adminUserId) {
  const hasChildProfilesOwnerKey = await hasColumn(client, "child_profiles", "owner_key");
  const hasGrowthEventsOwnerKey = await hasColumn(client, "growth_events", "owner_key");

  if (hasChildProfilesOwnerKey) {
    await client.query(
      `
        UPDATE child_profiles
        SET owner_id = $1
        WHERE owner_id IS NULL;
      `,
      [adminUserId]
    );
  }

  await client.query(
    `
      UPDATE food_progress
      SET owner_id = $1
      WHERE owner_id IS NULL;
    `,
    [adminUserId]
  );

  if (hasGrowthEventsOwnerKey) {
    await client.query(
      `
        UPDATE growth_events
        SET owner_id = $1
        WHERE owner_id IS NULL
          AND owner_key IS NOT NULL
          AND owner_key <> '__public__';
      `,
      [adminUserId]
    );

    await client.query(
      `
        UPDATE growth_events ge
        SET owner_id = COALESCE(
          (
            SELECT ge2.owner_id
            FROM growth_events ge2
            WHERE ge2.event_name = 'snapshot_link_created'
              AND ge2.owner_id IS NOT NULL
              AND ge2.metadata->>'shareId' = ge.metadata->>'shareId'
            ORDER BY ge2.id DESC
            LIMIT 1
          ),
          $1
        )
        WHERE ge.owner_id IS NULL
          AND ge.owner_key = '__public__'
          AND ge.metadata ? 'shareId';
      `,
      [adminUserId]
    );
  }

  await client.query(
    `
      UPDATE growth_events
      SET owner_id = $1
      WHERE owner_id IS NULL;
    `,
    [adminUserId]
  );
}

async function backfillShareSnapshots(client) {
  await client.query(`
    INSERT INTO share_snapshots (
      share_id,
      owner_id,
      visibility,
      first_name,
      introduced_count,
      total_foods,
      liked_count,
      milestone,
      recent_foods,
      created_at,
      expires_at
    )
    SELECT
      ge.metadata->>'shareId' AS share_id,
      ge.owner_id,
      'public'::event_visibility AS visibility,
      NULLIF(BTRIM(ge.metadata->>'firstName'), '') AS first_name,
      CASE
        WHEN ge.metadata->>'introducedCount' ~ '^-?[0-9]+$' THEN GREATEST((ge.metadata->>'introducedCount')::INTEGER, 0)
        ELSE 0
      END AS introduced_count,
      CASE
        WHEN ge.metadata->>'totalFoods' ~ '^-?[0-9]+$' THEN GREATEST((ge.metadata->>'totalFoods')::INTEGER, 0)
        ELSE 0
      END AS total_foods,
      CASE
        WHEN ge.metadata->>'likedCount' ~ '^-?[0-9]+$' THEN GREATEST((ge.metadata->>'likedCount')::INTEGER, 0)
        ELSE 0
      END AS liked_count,
      CASE
        WHEN ge.metadata->>'milestone' ~ '^-?[0-9]+$' THEN GREATEST((ge.metadata->>'milestone')::INTEGER, 0)
        ELSE NULL
      END AS milestone,
      CASE
        WHEN jsonb_typeof(ge.metadata->'recentFoods') = 'array' THEN ge.metadata->'recentFoods'
        ELSE '[]'::jsonb
      END AS recent_foods,
      ge.created_at,
      NULL
    FROM growth_events ge
    WHERE ge.event_name = 'snapshot_link_created'
      AND ge.metadata->>'shareId' ~ '^[a-zA-Z0-9_-]{8,80}$'
      AND ge.owner_id IS NOT NULL
    ON CONFLICT (share_id)
    DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      visibility = EXCLUDED.visibility,
      first_name = EXCLUDED.first_name,
      introduced_count = EXCLUDED.introduced_count,
      total_foods = EXCLUDED.total_foods,
      liked_count = EXCLUDED.liked_count,
      milestone = EXCLUDED.milestone,
      recent_foods = EXCLUDED.recent_foods;
  `);
}

async function enforceFinalConstraints(client) {
  const foodProgressNullOwners = await client.query(
    "SELECT COUNT(*)::INTEGER AS total FROM food_progress WHERE owner_id IS NULL;"
  );
  const childProfileNullOwners = await client.query(
    "SELECT COUNT(*)::INTEGER AS total FROM child_profiles WHERE owner_id IS NULL;"
  );
  const growthEventNullOwners = await client.query(
    "SELECT COUNT(*)::INTEGER AS total FROM growth_events WHERE owner_id IS NULL;"
  );

  if (Number(foodProgressNullOwners.rows[0]?.total || 0) > 0) {
    throw new Error("Impossible d'appliquer le modèle final: food_progress.owner_id contient des NULL.");
  }

  if (Number(childProfileNullOwners.rows[0]?.total || 0) > 0) {
    throw new Error("Impossible d'appliquer le modèle final: child_profiles.owner_id contient des NULL.");
  }

  if (Number(growthEventNullOwners.rows[0]?.total || 0) > 0) {
    throw new Error("Impossible d'appliquer le modèle final: growth_events.owner_id contient des NULL.");
  }

  await client.query(`
    ALTER TABLE food_progress
      ALTER COLUMN owner_id SET NOT NULL;
  `);

  await client.query(`
    ALTER TABLE child_profiles
      ALTER COLUMN owner_id SET NOT NULL;
  `);

  await client.query(`
    ALTER TABLE growth_events
      ALTER COLUMN owner_id SET NOT NULL;
  `);

  const foodProgressPkey = await client.query(
    `
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'food_progress'::regclass
        AND contype = 'p'
      LIMIT 1;
    `
  );

  const pkeyName = String(foodProgressPkey.rows[0]?.conname || "");
  const pkeyDefinition = String(foodProgressPkey.rows[0]?.definition || "");

  if (pkeyName && !pkeyDefinition.includes("(owner_id, food_id)")) {
    await client.query(`ALTER TABLE food_progress DROP CONSTRAINT ${quoteIdentifier(pkeyName)};`);
    await client.query("ALTER TABLE food_progress ADD PRIMARY KEY (owner_id, food_id);");
  }

  if (!pkeyName) {
    await client.query("ALTER TABLE food_progress ADD PRIMARY KEY (owner_id, food_id);");
  }

  await client.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_child_profiles_owner_id_unique ON child_profiles(owner_id);"
  );
}

async function run() {
  validateAdminCredentials();

  const pool = new Pool({ connectionString: getConnectionString() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminUserId = await ensureAdminUser(client);
    await assignLegacyOwners(client, adminUserId);
    await backfillShareSnapshots(client);
    await enforceFinalConstraints(client);

    await client.query("COMMIT");

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::INTEGER FROM users) AS users,
        (SELECT COUNT(*)::INTEGER FROM food_progress) AS food_progress,
        (SELECT COUNT(*)::INTEGER FROM child_profiles) AS child_profiles,
        (SELECT COUNT(*)::INTEGER FROM growth_events) AS growth_events,
        (SELECT COUNT(*)::INTEGER FROM share_snapshots) AS share_snapshots;
    `);

    console.log("[users:migrate-legacy] Done.");
    console.log("[users:migrate-legacy] Summary:", summary.rows[0]);
    console.log(`[users:migrate-legacy] Admin user: ${LEGACY_ADMIN_EMAIL}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("[users:migrate-legacy] Failed:", error);
  process.exit(1);
});
