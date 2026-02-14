import { query } from "@/lib/db";
import type { ChildProfile, DashboardCategory, PublicShareSnapshot } from "@/lib/types";

export type EventVisibility = "private" | "public";

type ShareSnapshotInput = {
  shareId: string;
  firstName: string | null;
  introducedCount: number;
  totalFoods: number;
  likedCount: number;
  milestone: number | null;
  recentFoods: string[];
  visibility?: EventVisibility;
  expiresAt?: string | null;
};

export async function getDashboardData(ownerId: number): Promise<DashboardCategory[]> {
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
    updated_at: string | null;
  }>(
    `
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
        COALESCE(p.note, '') AS note,
        CASE WHEN p.updated_at IS NULL THEN NULL ELSE p.updated_at::text END AS updated_at
      FROM categories c
      INNER JOIN foods f ON f.category_id = c.id
      LEFT JOIN food_progress p
        ON p.food_id = f.id
       AND p.owner_id = $1
      ORDER BY c.sort_order, f.sort_order;
    `,
    [ownerId]
  );

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
      note: row.note ?? "",
      updatedAt: row.updated_at
    });
  }

  return [...categoryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function upsertExposure(ownerId: number, foodId: number, exposureCount: number) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id, exposure_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        exposure_count = CASE
          WHEN food_progress.exposure_count = EXCLUDED.exposure_count THEN 0
          ELSE EXCLUDED.exposure_count
        END,
        first_tasted_on = CASE
          WHEN food_progress.exposure_count = EXCLUDED.exposure_count THEN NULL
          ELSE food_progress.first_tasted_on
        END,
        updated_at = NOW();
    `,
    [ownerId, foodId, exposureCount]
  );
}

export async function upsertPreference(ownerId: number, foodId: number, preference: -1 | 0 | 1) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id, preference)
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        preference = EXCLUDED.preference,
        updated_at = NOW();
    `,
    [ownerId, foodId, preference]
  );
}

export async function upsertFirstTastedOn(ownerId: number, foodId: number, firstTastedOn: string | null) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id, first_tasted_on)
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        first_tasted_on = EXCLUDED.first_tasted_on,
        updated_at = NOW();
    `,
    [ownerId, foodId, firstTastedOn]
  );
}

export async function markFirstTaste(ownerId: number, foodId: number, firstTastedOn: string) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id, exposure_count, first_tasted_on)
      VALUES ($1, $2, 1, $3)
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        exposure_count = GREATEST(food_progress.exposure_count, 1),
        first_tasted_on = COALESCE(food_progress.first_tasted_on, EXCLUDED.first_tasted_on),
        updated_at = NOW();
    `,
    [ownerId, foodId, firstTastedOn]
  );
}

export async function upsertNote(ownerId: number, foodId: number, note: string) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id, food_id)
      DO UPDATE SET
        note = EXCLUDED.note,
        updated_at = NOW();
    `,
    [ownerId, foodId, note]
  );
}

export async function getChildProfile(ownerId: number): Promise<ChildProfile | null> {
  const result = await query<{ first_name: string; birth_date: string }>(
    `
      SELECT
        first_name,
        birth_date::text AS birth_date
      FROM child_profiles
      WHERE owner_id = $1;
    `,
    [ownerId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    firstName: row.first_name,
    birthDate: row.birth_date
  };
}

export async function upsertChildProfile(ownerId: number, firstName: string, birthDate: string) {
  await query(
    `
      INSERT INTO child_profiles (owner_id, first_name, birth_date)
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        birth_date = EXCLUDED.birth_date,
        updated_at = NOW();
    `,
    [ownerId, firstName, birthDate]
  );
}

export async function createGrowthEvent(
  ownerId: number,
  eventName: string,
  channel: string | null,
  metadata: Record<string, unknown>,
  visibility: EventVisibility = "private"
) {
  await query(
    `
      INSERT INTO growth_events (owner_id, event_name, channel, visibility, metadata)
      VALUES ($1, $2, $3, $4::event_visibility, $5::jsonb);
    `,
    [ownerId, eventName, channel, visibility, JSON.stringify(metadata)]
  );
}

export async function upsertShareSnapshot(ownerId: number, payload: ShareSnapshotInput) {
  const recentFoods = payload.recentFoods.slice(0, 3);

  const result = await query(
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
        recent_foods,
        expires_at
      )
      VALUES ($1, $2, $3::event_visibility, $4, $5, $6, $7, $8, $9::jsonb, $10)
      ON CONFLICT (share_id)
      DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        visibility = EXCLUDED.visibility,
        first_name = EXCLUDED.first_name,
        introduced_count = EXCLUDED.introduced_count,
        total_foods = EXCLUDED.total_foods,
        liked_count = EXCLUDED.liked_count,
        milestone = EXCLUDED.milestone,
        recent_foods = EXCLUDED.recent_foods,
        expires_at = EXCLUDED.expires_at
      WHERE share_snapshots.owner_id = EXCLUDED.owner_id
      RETURNING share_id;
    `,
    [
      payload.shareId,
      ownerId,
      payload.visibility || "public",
      payload.firstName,
      payload.introducedCount,
      payload.totalFoods,
      payload.likedCount,
      payload.milestone,
      JSON.stringify(recentFoods),
      payload.expiresAt || null
    ]
  );

  if (result.rowCount !== 1) {
    throw new Error("Share ID already exists for another user.");
  }
}

export async function getPublicShareSnapshotById(shareId: string): Promise<PublicShareSnapshot | null> {
  const result = await query<{
    share_id: string;
    owner_id: number;
    first_name: string | null;
    introduced_count: number;
    total_foods: number;
    liked_count: number;
    milestone: number | null;
    recent_foods: unknown;
    created_at: string;
    expires_at: string | null;
  }>(
    `
      SELECT
        share_id,
        owner_id,
        first_name,
        introduced_count,
        total_foods,
        liked_count,
        milestone,
        recent_foods,
        created_at::text AS created_at,
        CASE WHEN expires_at IS NULL THEN NULL ELSE expires_at::text END AS expires_at
      FROM share_snapshots
      WHERE share_id = $1
        AND visibility = 'public'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1;
    `,
    [shareId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const recentFoods = Array.isArray(row.recent_foods)
    ? row.recent_foods.map((item) => String(item)).filter(Boolean).slice(0, 3)
    : [];

  return {
    shareId: row.share_id,
    ownerId: Number(row.owner_id),
    firstName: row.first_name,
    introducedCount: Number(row.introduced_count),
    totalFoods: Number(row.total_foods),
    likedCount: Number(row.liked_count),
    milestone: row.milestone === null ? null : Number(row.milestone),
    recentFoods,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}
