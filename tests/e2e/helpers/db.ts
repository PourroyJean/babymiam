import { execFileSync } from "node:child_process";
import argon2 from "argon2";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const DEFAULT_E2E_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam_e2e";
const DEFAULT_E2E_AUTH_EMAIL = (process.env.E2E_AUTH_EMAIL || "parent@example.com").toLowerCase();
const DEFAULT_E2E_AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || "LOULOU38";
const SAFE_E2E_DB_SUFFIX = /(_e2e|_test)$/i;
const LOCAL_RESET_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const E2E_RESETTABLE_TABLES = [
  "food_tastings",
  "food_progress",
  "child_profiles",
  "growth_events",
  "share_snapshots",
  "password_reset_tokens",
  "auth_password_reset_attempts",
  "email_verification_tokens",
  "auth_login_attempts",
  "auth_signup_attempts",
  "foods",
  "categories",
  "users"
];

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

type FixtureCategory = {
  name: string;
  foods: string[];
};

const FIXTURE_CATEGORIES: FixtureCategory[] = [
  {
    name: "Légumes",
    foods: ["Carotte", "Épinard", "Brocoli", "Courgette"]
  },
  {
    name: "Fruits",
    foods: ["Banane", "Pomme", "Poire"]
  },
  {
    name: "Féculents",
    foods: ["Riz", "Avoine", "Pomme de terre"]
  },
  {
    name: "Protéines",
    foods: ["Oeuf", "Poulet"]
  },
  {
    name: "Allergènes majeurs",
    foods: [
      "Céréales contenant du gluten",
      "Crustacés",
      "Oeufs",
      "Poissons",
      "Arachides",
      "Soja",
      "Lait",
      "Fruits à coque",
      "Céleri",
      "Moutarde",
      "Graines de sésame",
      "Anhydride sulfureux et sulfites",
      "Lupin",
      "Mollusques"
    ]
  }
];

let pool: Pool | null = null;
let cachedDefaultOwnerId: number | null = null;

function getConnectionString() {
  return process.env.E2E_POSTGRES_URL || DEFAULT_E2E_POSTGRES_URL;
}

function escapeIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || !error || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function assertSafeE2EResetTarget(targetUrl: URL) {
  const dbName = targetUrl.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("E2E_POSTGRES_URL doit inclure un nom de base de données.");
  }

  if (!SAFE_E2E_DB_SUFFIX.test(dbName)) {
    throw new Error(
      `Refus de reset destructif: la base "${dbName}" doit finir par _e2e ou _test (E2E_POSTGRES_URL).`
    );
  }

  const allowRemoteReset = process.env.E2E_ALLOW_REMOTE_DB_RESET === "1";
  if (!allowRemoteReset && !LOCAL_RESET_HOSTS.has(targetUrl.hostname)) {
    throw new Error(
      `Refus de reset destructif: hôte "${targetUrl.hostname}" non local. Définir E2E_ALLOW_REMOTE_DB_RESET=1 pour forcer.`
    );
  }

  return dbName;
}

async function truncateTableIfExists(client: PoolClient, tableName: string) {
  try {
    await client.query(`TRUNCATE TABLE ${escapeIdentifier(tableName)} RESTART IDENTITY CASCADE;`);
  } catch (error) {
    if (getErrorCode(error) === "42P01") return;
    throw error;
  }
}

async function resetDatabaseByTruncate(connectionString: string) {
  const fallbackPool = new Pool({ connectionString });
  const client = await fallbackPool.connect();

  try {
    await client.query("BEGIN");
    for (const tableName of E2E_RESETTABLE_TABLES) {
      await truncateTableIfExists(client, tableName);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await fallbackPool.end();
  }
}

async function resetDatabaseByDropCreate(targetUrl: URL, dbName: string) {
  const adminUrl = new URL(targetUrl.toString());
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    await adminPool.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid();
      `,
      [dbName]
    );

    await adminPool.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(dbName)}`);
    await adminPool.query(`CREATE DATABASE ${escapeIdentifier(dbName)}`);
  } finally {
    await adminPool.end();
  }
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() });
  }

  return pool;
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
  cachedDefaultOwnerId = null;
}

export async function ensureTestDatabaseReady() {
  await closePool();

  const targetUrl = new URL(getConnectionString());
  const dbName = assertSafeE2EResetTarget(targetUrl);

  try {
    await resetDatabaseByDropCreate(targetUrl, dbName);
  } catch (error) {
    console.warn(
      `[e2e:db] Reset DROP/CREATE indisponible (${formatError(error)}). Fallback en TRUNCATE.`
    );

    try {
      await resetDatabaseByTruncate(targetUrl.toString());
    } catch (fallbackError) {
      throw new Error(
        `[e2e:db] Impossible de reset la DB E2E. Primary=${formatError(error)}. Fallback=${formatError(fallbackError)}`
      );
    }
  }
}

export async function applyMigrations() {
  const runnerPath = path.join(process.cwd(), "scripts", "db", "migrate-runner.js");
  const connectionString = getConnectionString();

  try {
    execFileSync(process.execPath, [runnerPath, "up"], {
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        POSTGRES_URL: connectionString
      },
      stdio: "inherit"
    });
  } catch (error) {
    console.error("Failed to apply migrations in E2E setup:", error);
    throw error;
  }
}

export async function ensureAuthUser() {
  const passwordHash = await argon2.hash(DEFAULT_E2E_AUTH_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });

  const result = await queryMany<{ id: number }>(
    `
      INSERT INTO users (email, password_hash, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'active',
        updated_at = NOW()
      RETURNING id;
    `,
    [DEFAULT_E2E_AUTH_EMAIL, passwordHash]
  );

  cachedDefaultOwnerId = Number(result[0]?.id || 0);
}

export async function getDefaultOwnerId() {
  if (cachedDefaultOwnerId && cachedDefaultOwnerId > 0) {
    return cachedDefaultOwnerId;
  }

  const result = await queryOne<{ id: number }>(
    `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1;
    `,
    [DEFAULT_E2E_AUTH_EMAIL]
  );

  if (!result) {
    throw new Error(`Utilisateur E2E introuvable: ${DEFAULT_E2E_AUTH_EMAIL}`);
  }

  cachedDefaultOwnerId = Number(result.id);
  return cachedDefaultOwnerId;
}

export async function resetMutableTables() {
  await queryMany(
    "TRUNCATE TABLE food_tastings, food_progress, child_profiles, growth_events, share_snapshots, password_reset_tokens, auth_password_reset_attempts, email_verification_tokens, auth_login_attempts, auth_signup_attempts RESTART IDENTITY;"
  );
}

export async function seedFixtureData() {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE TABLE categories RESTART IDENTITY CASCADE;");

    for (let categoryIndex = 0; categoryIndex < FIXTURE_CATEGORIES.length; categoryIndex += 1) {
      const category = FIXTURE_CATEGORIES[categoryIndex];
      const categoryRes = await client.query<{ id: number }>(
        `
          INSERT INTO categories (name, sort_order)
          VALUES ($1, $2)
          RETURNING id;
        `,
        [category.name, categoryIndex]
      );

      const categoryId = Number(categoryRes.rows[0]?.id);

      for (let foodIndex = 0; foodIndex < category.foods.length; foodIndex += 1) {
        await client.query(
          `
            INSERT INTO foods (category_id, name, sort_order)
            VALUES ($1, $2, $3);
          `,
          [categoryId, category.foods[foodIndex], foodIndex]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryMany<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  const rows = await queryMany<T>(text, values);
  return rows[0] ?? null;
}

export type FoodProgressState = {
  ownerId: number;
  foodId: number;
  foodName: string;
  tastings: Array<{
    slot: 1 | 2 | 3;
    liked: boolean;
    tastedOn: string;
    note: string;
    textureLevel: 1 | 2 | 3 | 4 | null;
    reactionType: 0 | 1 | 2 | 3 | 4 | null;
  }>;
  tastingCount: number;
  finalPreference: -1 | 0 | 1;
  // Compatibility aliases used by legacy tests.
  exposureCount: number;
  preference: -1 | 0 | 1;
  firstTastedOn: string | null;
  note: string;
  updatedAt: string | null;
};

export async function getFoodProgressByName(foodName: string, ownerId?: number): Promise<FoodProgressState | null> {
  const resolvedOwnerId = ownerId ?? (await getDefaultOwnerId());

  const row = await queryOne<{
    owner_id: number;
    food_id: number;
    food_name: string;
    tastings: unknown;
    tasting_count: number;
    final_preference: number | null;
    note: string | null;
    updated_at: string | null;
  }>(
    `
      WITH tasting_agg AS (
        SELECT
          owner_id,
          food_id,
          COUNT(*)::int AS tasting_count,
          jsonb_agg(
            jsonb_build_object(
              'slot', slot,
              'liked', liked,
              'tastedOn', tasted_on::text,
              'note', note,
              'textureLevel', texture_level,
              'reactionType', reaction_type
            )
            ORDER BY slot
          ) AS tastings,
          MAX(updated_at) AS last_tasting_update
        FROM food_tastings
        WHERE owner_id = $2
        GROUP BY owner_id, food_id
      )
      SELECT
        COALESCE(p.owner_id, t.owner_id, $2::bigint) AS owner_id,
        f.id AS food_id,
        f.name AS food_name,
        COALESCE(t.tastings, '[]'::jsonb) AS tastings,
        COALESCE(t.tasting_count, 0) AS tasting_count,
        COALESCE(p.final_preference, 0) AS final_preference,
        COALESCE(p.note, '') AS note,
        CASE
          WHEN p.updated_at IS NULL AND t.last_tasting_update IS NULL THEN NULL
          WHEN p.updated_at IS NULL THEN t.last_tasting_update::text
          WHEN t.last_tasting_update IS NULL THEN p.updated_at::text
          ELSE GREATEST(p.updated_at, t.last_tasting_update)::text
        END AS updated_at
      FROM foods f
      LEFT JOIN food_progress p
        ON p.food_id = f.id
       AND p.owner_id = $2
      LEFT JOIN tasting_agg t
        ON t.food_id = f.id
       AND t.owner_id = $2
      WHERE f.name = $1;
    `,
    [foodName, resolvedOwnerId]
  );

  if (!row) return null;

  const tastings = Array.isArray(row.tastings)
    ? row.tastings
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const slot = Number((item as { slot?: unknown }).slot);
        const liked = (item as { liked?: unknown }).liked;
        const tastedOn = String((item as { tastedOn?: unknown }).tastedOn || "");
        const noteValue = (item as { note?: unknown }).note;
        const note = typeof noteValue === "string" ? noteValue : "";
        const textureLevelValue = (item as { textureLevel?: unknown }).textureLevel;
        const reactionTypeValue = (item as { reactionType?: unknown }).reactionType;
        const textureLevel =
          typeof textureLevelValue === "number" && [1, 2, 3, 4].includes(textureLevelValue)
            ? (textureLevelValue as 1 | 2 | 3 | 4)
            : null;
        const reactionType =
          typeof reactionTypeValue === "number" && [0, 1, 2, 3, 4].includes(reactionTypeValue)
            ? (reactionTypeValue as 0 | 1 | 2 | 3 | 4)
            : null;

        if (![1, 2, 3].includes(slot)) return null;
        if (typeof liked !== "boolean") return null;
        if (!tastedOn) return null;

        return {
          slot: slot as 1 | 2 | 3,
          liked,
          tastedOn,
          note,
          textureLevel,
          reactionType
        };
      })
      .filter(
        (
          entry
        ): entry is {
          slot: 1 | 2 | 3;
          liked: boolean;
          tastedOn: string;
          note: string;
          textureLevel: 1 | 2 | 3 | 4 | null;
          reactionType: 0 | 1 | 2 | 3 | 4 | null;
        } => entry !== null
      )
    : [];

  const tastingCount = Number(row.tasting_count ?? tastings.length);
  const firstTastedOn = tastings.find((entry) => entry.slot === 1)?.tastedOn ?? null;
  const finalPreference = Number(row.final_preference ?? 0) as -1 | 0 | 1;

  return {
    ownerId: Number(row.owner_id || resolvedOwnerId),
    foodId: Number(row.food_id),
    foodName: row.food_name,
    tastings,
    tastingCount,
    finalPreference,
    exposureCount: tastingCount,
    preference: finalPreference,
    firstTastedOn,
    note: row.note ?? "",
    updatedAt: row.updated_at
  };
}

export async function upsertFoodProgressByName(
  foodName: string,
  data: {
    exposureCount?: number;
    preference?: -1 | 0 | 1;
    firstTastedOn?: string | null;
    note?: string;
    ownerId?: number;
  }
) {
  const resolvedOwnerId = data.ownerId ?? (await getDefaultOwnerId());
  const existing = await getFoodProgressByName(foodName, resolvedOwnerId);
  if (!existing) {
    throw new Error(`Aliment introuvable dans la fixture: ${foodName}`);
  }

  const normalizeCount = (value: number) => Math.max(0, Math.min(3, Math.trunc(value)));
  const existingBySlot = new Map(existing.tastings.map((entry) => [entry.slot, entry]));
  const targetCount = normalizeCount(data.exposureCount ?? existing.tastingCount);

  const targetTastings: Array<{
    slot: 1 | 2 | 3;
    liked: boolean;
    tastedOn: string;
    note: string;
    textureLevel: 1 | 2 | 3 | 4 | null;
    reactionType: 0 | 1 | 2 | 3 | 4 | null;
  }> = [];
  for (let slot = 1; slot <= targetCount; slot += 1) {
    const normalizedSlot = slot as 1 | 2 | 3;
    const current = existingBySlot.get(normalizedSlot);
    targetTastings.push(
      current || {
        slot: normalizedSlot,
        liked: false,
        tastedOn: getTodayIsoDate(),
        note: "",
        textureLevel: null,
        reactionType: 0
      }
    );
  }

  if (data.firstTastedOn && targetTastings.length > 0) {
    targetTastings[0] = {
      ...targetTastings[0],
      tastedOn: data.firstTastedOn
    };
  }

  const preferredFinalPreference = data.preference ?? existing.finalPreference;
  const finalPreference = targetTastings.length === 3 ? preferredFinalPreference : 0;
  const note = data.note ?? existing.note;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id, final_preference, note, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (owner_id, food_id)
        DO UPDATE SET
          final_preference = EXCLUDED.final_preference,
          note = EXCLUDED.note,
          updated_at = NOW();
      `,
      [resolvedOwnerId, existing.foodId, finalPreference, note]
    );

    await client.query(
      `
        DELETE FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [resolvedOwnerId, existing.foodId]
    );

    for (const entry of targetTastings) {
      await client.query(
        `
          INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
        `,
        [
          resolvedOwnerId,
          existing.foodId,
          entry.slot,
          entry.liked,
          entry.tastedOn,
          entry.note,
          entry.textureLevel,
          entry.reactionType
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setFoodTastingsByName(
  foodName: string,
  tastings: Array<{
    slot: 1 | 2 | 3;
    liked: boolean;
    tastedOn: string;
    note?: string;
    textureLevel?: 1 | 2 | 3 | 4 | null;
    reactionType?: 0 | 1 | 2 | 3 | 4 | null;
  }>,
  options: {
    ownerId?: number;
    finalPreference?: -1 | 0 | 1;
    note?: string;
  } = {}
) {
  const resolvedOwnerId = options.ownerId ?? (await getDefaultOwnerId());
  const existing = await getFoodProgressByName(foodName, resolvedOwnerId);
  if (!existing) {
    throw new Error(`Aliment introuvable dans la fixture: ${foodName}`);
  }

  const normalized = [...tastings]
    .filter((entry) => [1, 2, 3].includes(entry.slot))
    .sort((a, b) => a.slot - b.slot)
    .slice(0, 3)
    .map((entry) => ({
      slot: entry.slot,
      liked: Boolean(entry.liked),
      tastedOn: entry.tastedOn,
      note: entry.note ?? "",
      textureLevel: entry.textureLevel ?? null,
      reactionType: entry.reactionType ?? 0
    }));

  const finalPreference =
    normalized.length === 3 ? (options.finalPreference ?? existing.finalPreference) : 0;
  const note = options.note ?? existing.note;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id, final_preference, note, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (owner_id, food_id)
        DO UPDATE SET
          final_preference = EXCLUDED.final_preference,
          note = EXCLUDED.note,
          updated_at = NOW();
      `,
      [resolvedOwnerId, existing.foodId, finalPreference, note]
    );

    await client.query(
      `
        DELETE FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [resolvedOwnerId, existing.foodId]
    );

    for (const entry of normalized) {
      await client.query(
        `
          INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
        `,
        [
          resolvedOwnerId,
          existing.foodId,
          entry.slot,
          entry.liked,
          entry.tastedOn,
          entry.note,
          entry.textureLevel,
          entry.reactionType
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setFinalPreferenceByName(foodName: string, finalPreference: -1 | 0 | 1, ownerId?: number) {
  const resolvedOwnerId = ownerId ?? (await getDefaultOwnerId());
  const existing = await getFoodProgressByName(foodName, resolvedOwnerId);
  if (!existing) {
    throw new Error(`Aliment introuvable dans la fixture: ${foodName}`);
  }

  await queryMany(
    `
      INSERT INTO food_progress (owner_id, food_id, final_preference, note, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        final_preference = EXCLUDED.final_preference,
        updated_at = NOW();
    `,
    [resolvedOwnerId, existing.foodId, finalPreference, existing.note]
  );
}

export async function replaceFoodTastingsByName(
  foodName: string,
  entries: Array<{
    slot: 1 | 2 | 3;
    liked: boolean;
    tastedOn: string;
    note?: string;
    textureLevel?: 1 | 2 | 3 | 4 | null;
    reactionType?: 0 | 1 | 2 | 3 | 4 | null;
  }>,
  ownerId?: number
) {
  const resolvedOwnerId = ownerId ?? (await getDefaultOwnerId());
  const existing = await getFoodProgressByName(foodName, resolvedOwnerId);
  if (!existing) {
    throw new Error(`Aliment introuvable dans la fixture: ${foodName}`);
  }

  await queryMany("DELETE FROM food_tastings WHERE owner_id = $1 AND food_id = $2;", [
    resolvedOwnerId,
    existing.foodId
  ]);

  for (const entry of entries) {
    await queryMany(
      `
        INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
      `,
      [
        resolvedOwnerId,
        existing.foodId,
        entry.slot,
        entry.liked,
        entry.tastedOn,
        entry.note ?? "",
        entry.textureLevel ?? null,
        entry.reactionType ?? 0
      ]
    );
  }
}

export async function setIntroducedFoods(count: number, ownerId?: number) {
  const resolvedOwnerId = ownerId ?? (await getDefaultOwnerId());
  const normalizedCount = Math.max(0, Math.trunc(count));

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM food_tastings WHERE owner_id = $1;", [resolvedOwnerId]);
    await client.query("DELETE FROM food_progress WHERE owner_id = $1;", [resolvedOwnerId]);
    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id, final_preference, note, updated_at)
        SELECT $1, id, 0, '', NOW()
        FROM foods
        ORDER BY id
        LIMIT $2;
      `,
      [resolvedOwnerId, normalizedCount]
    );
    await client.query(
      `
        INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type, updated_at)
        SELECT $1, id, 1, false, CURRENT_DATE, '', NULL, 0, NOW()
        FROM foods
        ORDER BY id
        LIMIT $2;
      `,
      [resolvedOwnerId, normalizedCount]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createShareSnapshot(payload: {
  shareId: string;
  ownerId?: number;
  firstName?: string | null;
  introducedCount?: number;
  totalFoods?: number;
  likedCount?: number;
  milestone?: number | null;
  recentFoods?: string[];
}) {
  const resolvedOwnerId = payload.ownerId ?? (await getDefaultOwnerId());

  await queryMany(
    `
      INSERT INTO share_snapshots (
        share_id,
        owner_id,
        visibility,
        first_name,
        introduced_count,
        total_foods,
        liked_count,
        milestone,
        recent_foods
      )
      VALUES ($1, $2, 'public', $3, $4, $5, $6, $7, $8::jsonb)
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
    `,
    [
      payload.shareId,
      resolvedOwnerId,
      payload.firstName || null,
      payload.introducedCount ?? 0,
      payload.totalFoods ?? 0,
      payload.likedCount ?? 0,
      payload.milestone ?? null,
      JSON.stringify(payload.recentFoods || [])
    ]
  );
}

export type GrowthEventState = {
  id: number;
  ownerId: number;
  eventName: string;
  channel: string | null;
  visibility: "private" | "public";
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function getGrowthEvents(eventName?: string): Promise<GrowthEventState[]> {
  const rows = eventName
    ? await queryMany<{
      id: number;
      owner_id: number;
      event_name: string;
      channel: string | null;
      visibility: "private" | "public";
      metadata: Record<string, unknown>;
      created_at: string;
    }>(
      `
          SELECT id, owner_id, event_name, channel, visibility, metadata, created_at::text AS created_at
          FROM growth_events
          WHERE event_name = $1
          ORDER BY id ASC;
        `,
      [eventName]
    )
    : await queryMany<{
      id: number;
      owner_id: number;
      event_name: string;
      channel: string | null;
      visibility: "private" | "public";
      metadata: Record<string, unknown>;
      created_at: string;
    }>(
      `
          SELECT id, owner_id, event_name, channel, visibility, metadata, created_at::text AS created_at
          FROM growth_events
          ORDER BY id ASC;
        `
    );

  return rows.map((row) => ({
    id: Number(row.id),
    ownerId: Number(row.owner_id),
    eventName: row.event_name,
    channel: row.channel,
    visibility: row.visibility,
    metadata: row.metadata || {},
    createdAt: row.created_at
  }));
}
