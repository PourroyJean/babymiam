import { Pool } from "pg";
import type { DashboardCategory } from "@/lib/types";

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function normalizeConnectionString(value: string) {
  try {
    const parsed = new URL(value);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const useLibpqCompat = parsed.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";

    if (!sslMode || useLibpqCompat) return value;

    // pg currently treats these sslmodes like verify-full and warns that behavior will change in v9.
    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }

    return value;
  } catch {
    return value;
  }
}

declare global {
  var __babymiamPool: Pool | undefined;
}

function getConnectionString() {
  const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL || LOCAL_POSTGRES_URL;
  return normalizeConnectionString(raw);
}

function getPool() {
  if (!global.__babymiamPool) {
    global.__babymiamPool = new Pool({
      connectionString: getConnectionString(),
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    });
  }

  return global.__babymiamPool;
}

async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = []
) {
  const pool = getPool();
  return pool.query<T>(text, values);
}

export async function getDashboardData(): Promise<DashboardCategory[]> {
  const result = await query<{
    category_id: number;
    category_name: string;
    category_sort_order: number;
    food_id: number;
    food_name: string;
    food_sort_order: number;
    exposure_count: number;
    preference: number;
    first_tasted_on: string | null;
    note: string | null;
  }>(`
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      c.sort_order AS category_sort_order,
      f.id AS food_id,
      f.name AS food_name,
      f.sort_order AS food_sort_order,
      COALESCE(p.exposure_count, 0) AS exposure_count,
      COALESCE(p.preference, 0) AS preference,
      CASE WHEN p.first_tasted_on IS NULL THEN NULL ELSE p.first_tasted_on::text END AS first_tasted_on,
      COALESCE(p.note, '') AS note
    FROM categories c
    INNER JOIN foods f ON f.category_id = c.id
    LEFT JOIN food_progress p ON p.food_id = f.id
    ORDER BY c.sort_order, f.sort_order;
  `);

  const categoryMap = new Map<number, DashboardCategory>();

  for (const row of result.rows) {
    const categoryId = Number(row.category_id);
    const categorySortOrder = Number(row.category_sort_order);
    const foodId = Number(row.food_id);
    const foodSortOrder = Number(row.food_sort_order);
    const exposureCount = Number(row.exposure_count);
    const preference = Number(row.preference) as -1 | 0 | 1;

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: categoryId,
        name: row.category_name,
        sortOrder: categorySortOrder,
        foods: []
      });
    }

    categoryMap.get(categoryId)?.foods.push({
      id: foodId,
      name: row.food_name,
      sortOrder: foodSortOrder,
      exposureCount,
      preference,
      firstTastedOn: row.first_tasted_on,
      note: row.note ?? ""
    });
  }

  return [...categoryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function upsertExposure(foodId: number, exposureCount: number) {
  await query(
    `
    INSERT INTO food_progress (food_id, exposure_count)
    VALUES ($1, $2)
    ON CONFLICT (food_id)
    DO UPDATE SET
      exposure_count = EXCLUDED.exposure_count,
      updated_at = NOW();
    `,
    [foodId, exposureCount]
  );
}

export async function upsertPreference(foodId: number, preference: -1 | 0 | 1) {
  await query(
    `
    INSERT INTO food_progress (food_id, preference)
    VALUES ($1, $2)
    ON CONFLICT (food_id)
    DO UPDATE SET
      preference = EXCLUDED.preference,
      updated_at = NOW();
    `,
    [foodId, preference]
  );
}

export async function upsertFirstTastedOn(foodId: number, firstTastedOn: string | null) {
  await query(
    `
    INSERT INTO food_progress (food_id, first_tasted_on)
    VALUES ($1, $2)
    ON CONFLICT (food_id)
    DO UPDATE SET
      first_tasted_on = EXCLUDED.first_tasted_on,
      updated_at = NOW();
    `,
    [foodId, firstTastedOn]
  );
}

export async function upsertNote(foodId: number, note: string) {
  await query(
    `
    INSERT INTO food_progress (food_id, note)
    VALUES ($1, $2)
    ON CONFLICT (food_id)
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = NOW();
    `,
    [foodId, note]
  );
}
