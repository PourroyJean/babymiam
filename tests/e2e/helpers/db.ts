import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type QueryResultRow } from "pg";

const DEFAULT_E2E_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam_e2e";

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
    foods: ["Arachide", "Sésame"]
  }
];

let pool: Pool | null = null;

function getConnectionString() {
  return process.env.E2E_POSTGRES_URL || DEFAULT_E2E_POSTGRES_URL;
}

function escapeIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
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
}

export async function ensureTestDatabaseReady() {
  const targetUrl = new URL(getConnectionString());
  const dbName = targetUrl.pathname.replace(/^\//, "");

  if (!dbName) {
    throw new Error("E2E_POSTGRES_URL doit inclure un nom de base de données.");
  }

  const adminUrl = new URL(targetUrl.toString());
  adminUrl.pathname = "/postgres";

  const adminPool = new Pool({ connectionString: adminUrl.toString() });

  try {
    const exists = await adminPool.query<{ present: number }>(
      "SELECT 1 AS present FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (exists.rowCount && exists.rowCount > 0) return;

    try {
      await adminPool.query(`CREATE DATABASE ${escapeIdentifier(dbName)}`);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "42P04"
      ) {
        return;
      }

      throw error;
    }
  } finally {
    await adminPool.end();
  }
}

export async function applyMigrations() {
  const migrationPath = path.join(process.cwd(), "scripts", "db", "migrate.sql");
  const migrationSql = await fs.readFile(migrationPath, "utf8");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetMutableTables() {
  await queryMany("TRUNCATE TABLE food_progress, child_profiles, growth_events RESTART IDENTITY;");
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
  foodId: number;
  foodName: string;
  exposureCount: number;
  preference: -1 | 0 | 1;
  firstTastedOn: string | null;
  note: string;
  updatedAt: string | null;
};

export async function getFoodProgressByName(foodName: string): Promise<FoodProgressState | null> {
  const row = await queryOne<{
    food_id: number;
    food_name: string;
    exposure_count: number | null;
    preference: number | null;
    first_tasted_on: string | null;
    note: string | null;
    updated_at: string | null;
  }>(
    `
      SELECT
        f.id AS food_id,
        f.name AS food_name,
        p.exposure_count,
        p.preference,
        CASE WHEN p.first_tasted_on IS NULL THEN NULL ELSE p.first_tasted_on::text END AS first_tasted_on,
        p.note,
        CASE WHEN p.updated_at IS NULL THEN NULL ELSE p.updated_at::text END AS updated_at
      FROM foods f
      LEFT JOIN food_progress p ON p.food_id = f.id
      WHERE f.name = $1;
    `,
    [foodName]
  );

  if (!row) return null;

  return {
    foodId: Number(row.food_id),
    foodName: row.food_name,
    exposureCount: Number(row.exposure_count ?? 0),
    preference: Number(row.preference ?? 0) as -1 | 0 | 1,
    firstTastedOn: row.first_tasted_on,
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
  }
) {
  const existing = await getFoodProgressByName(foodName);
  if (!existing) {
    throw new Error(`Aliment introuvable dans la fixture: ${foodName}`);
  }

  const exposureCount = data.exposureCount ?? existing.exposureCount;
  const preference = data.preference ?? existing.preference;
  const firstTastedOn =
    data.firstTastedOn === undefined ? existing.firstTastedOn : data.firstTastedOn;
  const note = data.note ?? existing.note;

  await queryMany(
    `
      INSERT INTO food_progress (food_id, exposure_count, preference, first_tasted_on, note, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (food_id)
      DO UPDATE SET
        exposure_count = EXCLUDED.exposure_count,
        preference = EXCLUDED.preference,
        first_tasted_on = EXCLUDED.first_tasted_on,
        note = EXCLUDED.note,
        updated_at = NOW();
    `,
    [existing.foodId, exposureCount, preference, firstTastedOn, note]
  );
}

export async function setIntroducedFoods(count: number) {
  const normalizedCount = Math.max(0, Math.trunc(count));

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM food_progress;");
    await client.query(
      `
        INSERT INTO food_progress (food_id, exposure_count, preference, note, updated_at)
        SELECT id, 1, 0, '', NOW()
        FROM foods
        ORDER BY id
        LIMIT $1;
      `,
      [normalizedCount]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type GrowthEventState = {
  id: number;
  ownerKey: string;
  eventName: string;
  channel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function getGrowthEvents(eventName?: string): Promise<GrowthEventState[]> {
  const rows = eventName
    ? await queryMany<{
        id: number;
        owner_key: string;
        event_name: string;
        channel: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>(
        `
          SELECT id, owner_key, event_name, channel, metadata, created_at::text AS created_at
          FROM growth_events
          WHERE event_name = $1
          ORDER BY id ASC;
        `,
        [eventName]
      )
    : await queryMany<{
        id: number;
        owner_key: string;
        event_name: string;
        channel: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>(
        `
          SELECT id, owner_key, event_name, channel, metadata, created_at::text AS created_at
          FROM growth_events
          ORDER BY id ASC;
        `
      );

  return rows.map((row) => ({
    id: Number(row.id),
    ownerKey: row.owner_key,
    eventName: row.event_name,
    channel: row.channel,
    metadata: row.metadata || {},
    createdAt: row.created_at
  }));
}
