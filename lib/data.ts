import { readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import type { DashboardCategory } from "@/lib/types";

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

type SourceCategory = {
  categorie: string;
  aliments: string[];
};

declare global {
  var __babymiamDbInit: Promise<void> | undefined;
  var __babymiamPool: Pool | undefined;
}

function ensureConnectionString() {
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = LOCAL_POSTGRES_URL;
  }
}

function getPool() {
  ensureConnectionString();

  if (!global.__babymiamPool) {
    global.__babymiamPool = new Pool({
      connectionString: process.env.POSTGRES_URL
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

async function readSourceCategories(): Promise<SourceCategory[]> {
  const filePath = path.join(process.cwd(), "aliments_categories.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as { categories?: SourceCategory[] };

  return Array.isArray(parsed.categories) ? parsed.categories : [];
}

export async function ensureDatabaseReady() {
  if (!global.__babymiamDbInit) {
    const initPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          sort_order INTEGER NOT NULL
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS foods (
          id SERIAL PRIMARY KEY,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          UNIQUE(category_id, name)
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS food_progress (
          food_id INTEGER PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,
          exposure_count INTEGER NOT NULL DEFAULT 0 CHECK (exposure_count BETWEEN 0 AND 3),
          preference SMALLINT NOT NULL DEFAULT 0 CHECK (preference BETWEEN -1 AND 1),
          first_tasted_on DATE,
          note TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const categories = await readSourceCategories();
      for (let c = 0; c < categories.length; c += 1) {
        const category = categories[c];
        const categoryRes = await query<{ id: number }>(
          `
          INSERT INTO categories (name, sort_order)
          VALUES ($1, $2)
          ON CONFLICT (name)
          DO UPDATE SET sort_order = EXCLUDED.sort_order
          RETURNING id;
          `,
          [category.categorie, c]
        );

        if (!categoryRes.rows[0]) continue;
        const categoryId = categoryRes.rows[0].id;

        for (let i = 0; i < category.aliments.length; i += 1) {
          await query(
            `
            INSERT INTO foods (category_id, name, sort_order)
            VALUES ($1, $2, $3)
            ON CONFLICT (category_id, name)
            DO UPDATE SET sort_order = EXCLUDED.sort_order;
            `,
            [categoryId, category.aliments[i], i]
          );
        }
      }
    })();

    const guardedInitPromise = initPromise.catch((error) => {
      if (global.__babymiamDbInit === guardedInitPromise) {
        global.__babymiamDbInit = undefined;
      }
      throw error;
    });
    global.__babymiamDbInit = guardedInitPromise;
  }

  await global.__babymiamDbInit;
}

export async function getDashboardData(): Promise<DashboardCategory[]> {
  await ensureDatabaseReady();

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
  await ensureDatabaseReady();
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
  await ensureDatabaseReady();
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
  await ensureDatabaseReady();
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
  await ensureDatabaseReady();
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
