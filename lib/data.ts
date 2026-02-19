import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db";
import type {
  ChildProfile,
  DashboardCategory,
  FoodTastingEntry,
  FoodTimelineEntry,
  PublicShareSnapshot
} from "@/lib/types";
import type { ReactionType, TextureLevel } from "@/lib/tasting-metadata";

export type EventVisibility = "private" | "public";

type DeleteTastingResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

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

export type UpsertShareSnapshotResult = {
  shareId: string;
  expiresAt: string | null;
};

type AppendQuickEntryInput = {
  foodId: number;
  tastedOn: string;
  liked: boolean;
  note: string;
  textureLevel: TextureLevel | null;
  reactionType: ReactionType | null;
};

export type SaveFoodSummaryInput = {
  slot: 1 | 2 | 3;
  liked: boolean;
  tastedOn: string;
  note: string;
  textureLevel: TextureLevel | null;
  reactionType: ReactionType;
};

export type AppendQuickEntryResult = {
  status: "ok" | "maxed" | "food_not_found" | "unavailable";
};

type FoodProgressColumns = {
  hasExposureCount: boolean;
  hasFirstTastedOn: boolean;
  hasNote: boolean;
  hasUpdatedAt: boolean;
};

const DEFAULT_SHARE_SNAPSHOT_TTL_DAYS = 30;
const MAX_SHARE_SNAPSHOT_TTL_DAYS = 365;
const SHARE_OPEN_DEDUPE_MINUTES = 5;

function getShareSnapshotTtlDays() {
  const parsed = Number(process.env.SHARE_SNAPSHOT_TTL_DAYS || DEFAULT_SHARE_SNAPSHOT_TTL_DAYS);
  if (!Number.isFinite(parsed)) return DEFAULT_SHARE_SNAPSHOT_TTL_DAYS;

  const normalized = Math.trunc(parsed);
  if (normalized < 1) return DEFAULT_SHARE_SNAPSHOT_TTL_DAYS;
  return Math.min(normalized, MAX_SHARE_SNAPSHOT_TTL_DAYS);
}

function resolveShareSnapshotExpiresAt(expiresAt: string | null | undefined) {
  const normalized = String(expiresAt || "").trim();
  if (normalized) return normalized;

  const ttlDays = getShareSnapshotTtlDays();
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

async function getFoodProgressColumns(client: PoolClient): Promise<FoodProgressColumns> {
  const result = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'food_progress';
    `
  );

  const columnNames = new Set(result.rows.map((row) => row.column_name));
  return {
    hasExposureCount: columnNames.has("exposure_count"),
    hasFirstTastedOn: columnNames.has("first_tasted_on"),
    hasNote: columnNames.has("note"),
    hasUpdatedAt: columnNames.has("updated_at")
  };
}

export async function appendQuickEntry(ownerId: number, payload: AppendQuickEntryInput): Promise<AppendQuickEntryResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tableCheckResult = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.food_tastings') IS NOT NULL AS exists;"
    );
    if (!tableCheckResult.rows[0]?.exists) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }

    const foodCheckResult = await client.query("SELECT 1 FROM foods WHERE id = $1 LIMIT 1;", [payload.foodId]);
    if (!foodCheckResult.rowCount) {
      await client.query("ROLLBACK");
      return { status: "food_not_found" };
    }

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id)
        VALUES ($1, $2)
        ON CONFLICT (owner_id, food_id) DO NOTHING;
      `,
      [ownerId, payload.foodId]
    );

    await client.query("SELECT 1 FROM food_progress WHERE owner_id = $1 AND food_id = $2 FOR UPDATE;", [
      ownerId,
      payload.foodId
    ]);

    const existingSlotsResult = await client.query<{ slot: number }>(
      `
        SELECT slot
        FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2
        ORDER BY slot
        FOR UPDATE;
      `,
      [ownerId, payload.foodId]
    );

    const takenSlots = new Set(existingSlotsResult.rows.map((row) => Number(row.slot)));
    let nextSlot: number | null = null;
    for (let slot = 1; slot <= 3; slot += 1) {
      if (!takenSlots.has(slot)) {
        nextSlot = slot;
        break;
      }
    }

    if (nextSlot === null) {
      await client.query("ROLLBACK");
      return { status: "maxed" };
    }

    await client.query(
      `
        INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type)
        VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8);
      `,
      [
        ownerId,
        payload.foodId,
        nextSlot,
        payload.liked,
        payload.tastedOn,
        payload.note,
        payload.textureLevel,
        payload.reactionType
      ]
    );

    const nextExposureCount = Math.min(3, takenSlots.size + 1);
    const progressColumns = await getFoodProgressColumns(client);
    const updateParams: unknown[] = [ownerId, payload.foodId];
    const setClauses: string[] = [];
    let exposureRef: string | null = null;
    let tastedOnRef: string | null = null;

    if (progressColumns.hasExposureCount) {
      exposureRef = `$${updateParams.push(nextExposureCount)}`;
      setClauses.push(`exposure_count = ${exposureRef}`);
    }

    if (progressColumns.hasFirstTastedOn) {
      tastedOnRef = `$${updateParams.push(payload.tastedOn)}`;
      setClauses.push(`first_tasted_on = COALESCE(food_progress.first_tasted_on, ${tastedOnRef}::date)`);
    }

    if (progressColumns.hasUpdatedAt) {
      setClauses.push("updated_at = NOW()");
    }

    if (setClauses.length > 0) {
      await client.query(
        `
          UPDATE food_progress
          SET ${setClauses.join(", ")}
          WHERE owner_id = $1
            AND food_id = $2;
        `,
        updateParams
      );
    }

    await client.query("COMMIT");
    return { status: "ok" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getDashboardData(ownerId: number): Promise<DashboardCategory[]> {
  const result = await query<{
    category_id: number;
    category_name: string;
    category_sort_order: number;
    food_id: number;
    food_name: string;
    food_sort_order: number;
    tasting_count: number;
    tastings: unknown;
    final_preference: number;
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
        WHERE owner_id = $1
        GROUP BY owner_id, food_id
      )
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.sort_order AS category_sort_order,
        f.id AS food_id,
        f.name AS food_name,
        f.sort_order AS food_sort_order,
        COALESCE(t.tasting_count, 0) AS tasting_count,
        COALESCE(t.tastings, '[]'::jsonb) AS tastings,
        COALESCE(p.final_preference, 0) AS final_preference,
        COALESCE(p.note, '') AS note,
        CASE
          WHEN p.updated_at IS NULL AND t.last_tasting_update IS NULL THEN NULL
          WHEN p.updated_at IS NULL THEN t.last_tasting_update::text
          WHEN t.last_tasting_update IS NULL THEN p.updated_at::text
          ELSE GREATEST(p.updated_at, t.last_tasting_update)::text
        END AS updated_at
      FROM categories c
      INNER JOIN foods f ON f.category_id = c.id
      LEFT JOIN food_progress p
        ON p.food_id = f.id
       AND p.owner_id = $1
      LEFT JOIN tasting_agg t
        ON t.food_id = f.id
       AND t.owner_id = $1
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

    const tastings: FoodTastingEntry[] = Array.isArray(row.tastings)
      ? row.tastings
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const slot = Number((item as { slot?: unknown }).slot);
            const liked = (item as { liked?: unknown }).liked;
            const tastedOn = String((item as { tastedOn?: unknown }).tastedOn || "");
            const noteValue = (item as { note?: unknown }).note;
            const note = typeof noteValue === "string" ? noteValue : "";
            const rawTextureLevel = (item as { textureLevel?: unknown }).textureLevel;
            const rawReactionType = (item as { reactionType?: unknown }).reactionType;
            const textureLevel =
              typeof rawTextureLevel === "number" && [1, 2, 3, 4].includes(rawTextureLevel)
                ? (rawTextureLevel as TextureLevel)
                : null;
            const reactionType =
              typeof rawReactionType === "number" && [0, 1, 2, 3, 4].includes(rawReactionType)
                ? (rawReactionType as ReactionType)
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
          .filter((value): value is FoodTastingEntry => value !== null)
      : [];

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
      tastings,
      tastingCount: Number(row.tasting_count || 0),
      finalPreference: Number(row.final_preference || 0) as -1 | 0 | 1,
      note: row.note ?? "",
      updatedAt: row.updated_at
    });
  }

  return [...categoryMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getFoodTimeline(ownerId: number): Promise<FoodTimelineEntry[]> {
  const result = await query<{
    food_id: number;
    food_name: string;
    category_name: string;
    slot: number;
    liked: boolean;
    tasted_on: string;
    note: string | null;
    texture_level: number | null;
    reaction_type: number | null;
  }>(
    `
      SELECT
        t.food_id,
        f.name AS food_name,
        c.name AS category_name,
        t.slot,
        t.liked,
        t.tasted_on::text AS tasted_on,
        COALESCE(t.note, '') AS note,
        t.texture_level,
        t.reaction_type
      FROM food_tastings t
      INNER JOIN foods f ON f.id = t.food_id
      INNER JOIN categories c ON c.id = f.category_id
      WHERE t.owner_id = $1
      ORDER BY
        t.tasted_on DESC,
        c.sort_order ASC,
        f.sort_order ASC,
        t.slot ASC;
    `,
    [ownerId]
  );

  return result.rows
    .map((row) => {
      const slot = Number(row.slot);
      if (![1, 2, 3].includes(slot)) return null;

      return {
        foodId: Number(row.food_id),
        foodName: row.food_name,
        categoryName: row.category_name,
        slot: slot as 1 | 2 | 3,
        tastedOn: row.tasted_on,
        liked: Boolean(row.liked),
        note: row.note ?? "",
        textureLevel:
          typeof row.texture_level === "number" && [1, 2, 3, 4].includes(row.texture_level)
            ? (row.texture_level as TextureLevel)
            : null,
        reactionType:
          typeof row.reaction_type === "number" && [0, 1, 2, 3, 4].includes(row.reaction_type)
            ? (row.reaction_type as ReactionType)
            : null
      };
    })
    .filter((entry): entry is FoodTimelineEntry => entry !== null);
}

async function ensureFoodProgressRow(ownerId: number, foodId: number) {
  await query(
    `
      INSERT INTO food_progress (owner_id, food_id)
      VALUES ($1, $2)
      ON CONFLICT (owner_id, food_id) DO NOTHING;
    `,
    [ownerId, foodId]
  );
}

export async function upsertFoodTastingEntry(
  ownerId: number,
  foodId: number,
  slot: 1 | 2 | 3,
  liked: boolean,
  tastedOn: string,
  note: string,
  textureLevel: TextureLevel | null,
  reactionType: ReactionType | null
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id)
        VALUES ($1, $2)
        ON CONFLICT (owner_id, food_id) DO NOTHING;
      `,
      [ownerId, foodId]
    );

    await client.query(
      `
        INSERT INTO food_tastings (owner_id, food_id, slot, liked, tasted_on, note, texture_level, reaction_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (owner_id, food_id, slot)
        DO UPDATE SET
          liked = EXCLUDED.liked,
          tasted_on = EXCLUDED.tasted_on,
          note = EXCLUDED.note,
          texture_level = EXCLUDED.texture_level,
          reaction_type = EXCLUDED.reaction_type,
          updated_at = NOW();
      `,
      [ownerId, foodId, slot, liked, tastedOn, note, textureLevel, reactionType]
    );

    await client.query(
      `
        UPDATE food_progress
        SET updated_at = NOW()
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteFoodTastingEntry(
  ownerId: number,
  foodId: number,
  slot: 1 | 2 | 3
): Promise<DeleteTastingResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const maxSlotResult = await client.query<{ max_slot: number }>(
      `
        SELECT COALESCE(MAX(slot), 0)::int AS max_slot
        FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId]
    );

    const maxSlot = Number(maxSlotResult.rows[0]?.max_slot || 0);
    if (!maxSlot) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Aucune entrée à supprimer." };
    }

    if (slot !== maxSlot) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Seule la dernière entrée peut être supprimée." };
    }

    await client.query(
      `
        DELETE FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2
          AND slot = $3;
      `,
      [ownerId, foodId, slot]
    );

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id)
        VALUES ($1, $2)
        ON CONFLICT (owner_id, food_id) DO NOTHING;
      `,
      [ownerId, foodId]
    );

    const remainingResult = await client.query<{ remaining_count: number }>(
      `
        SELECT COUNT(*)::int AS remaining_count
        FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId]
    );

    const remainingCount = Number(remainingResult.rows[0]?.remaining_count || 0);
    if (remainingCount < 3) {
      await client.query(
        `
          UPDATE food_progress
          SET final_preference = 0
          WHERE owner_id = $1
            AND food_id = $2;
        `,
        [ownerId, foodId]
      );
    }

    await client.query(
      `
        UPDATE food_progress
        SET updated_at = NOW()
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertFinalPreference(
  ownerId: number,
  foodId: number,
  finalPreference: -1 | 0 | 1
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id)
        VALUES ($1, $2)
        ON CONFLICT (owner_id, food_id) DO NOTHING;
      `,
      [ownerId, foodId]
    );

    const tastingCountResult = await client.query<{ tasting_count: number }>(
      `
        SELECT COUNT(*)::int AS tasting_count
        FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId]
    );

    const tastingCount = Number(tastingCountResult.rows[0]?.tasting_count || 0);
    const appliedPreference = tastingCount === 3 ? finalPreference : 0;

    await client.query(
      `
        UPDATE food_progress
        SET
          final_preference = $3,
          updated_at = NOW()
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId, appliedPreference]
    );

    await client.query("COMMIT");
    return appliedPreference as -1 | 0 | 1;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertNote(ownerId: number, foodId: number, note: string) {
  await ensureFoodProgressRow(ownerId, foodId);
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

export async function saveFoodSummary(
  ownerId: number,
  foodId: number,
  note: string,
  tastings: SaveFoodSummaryInput[]
) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO food_progress (owner_id, food_id)
        VALUES ($1, $2)
        ON CONFLICT (owner_id, food_id) DO NOTHING;
      `,
      [ownerId, foodId]
    );

    await client.query("SELECT 1 FROM food_progress WHERE owner_id = $1 AND food_id = $2 FOR UPDATE;", [
      ownerId,
      foodId
    ]);

    const existingSlotsResult = await client.query<{ slot: number }>(
      `
        SELECT slot
        FROM food_tastings
        WHERE owner_id = $1
          AND food_id = $2
        FOR UPDATE;
      `,
      [ownerId, foodId]
    );
    const existingSlots = new Set(existingSlotsResult.rows.map((row) => Number(row.slot)));

    for (const tasting of tastings) {
      if (!existingSlots.has(tasting.slot)) {
        throw new Error("Summary update contains an unknown tasting slot.");
      }
    }

    for (const tasting of tastings) {
      const result = await client.query(
        `
          UPDATE food_tastings
          SET
            liked = $4,
            tasted_on = $5::date,
            note = $6,
            texture_level = $7,
            reaction_type = $8,
            updated_at = NOW()
          WHERE owner_id = $1
            AND food_id = $2
            AND slot = $3;
        `,
        [
          ownerId,
          foodId,
          tasting.slot,
          tasting.liked,
          tasting.tastedOn,
          tasting.note,
          tasting.textureLevel,
          tasting.reactionType
        ]
      );

      if (result.rowCount !== 1) {
        throw new Error("Failed to update tasting in summary save.");
      }
    }

    await client.query(
      `
        UPDATE food_progress
        SET
          note = $3,
          updated_at = NOW()
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      [ownerId, foodId, note]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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

export async function createPublicShareOpenEvent(
  ownerId: number,
  shareId: string,
  metadata: Record<string, unknown>
) {
  const existingResult = await query(
    `
      SELECT 1
      FROM growth_events
      WHERE owner_id = $1
        AND event_name = 'snapshot_link_opened'
        AND channel = 'public_page'
        AND visibility = 'public'
        AND metadata->>'shareId' = $2
        AND created_at > NOW() - INTERVAL '${SHARE_OPEN_DEDUPE_MINUTES} minutes'
      LIMIT 1;
    `,
    [ownerId, shareId]
  );

  if (Number(existingResult.rowCount || 0) > 0) return false;

  await createGrowthEvent(ownerId, "snapshot_link_opened", "public_page", metadata, "public");
  return true;
}

export async function revokeShareSnapshot(ownerId: number, shareId: string) {
  const result = await query<{ share_id: string }>(
    `
      UPDATE share_snapshots
      SET
        visibility = 'private',
        expires_at = NOW()
      WHERE owner_id = $1
        AND share_id = $2
        AND visibility = 'public'
      RETURNING share_id;
    `,
    [ownerId, shareId]
  );

  return result.rowCount === 1;
}

export async function upsertShareSnapshot(
  ownerId: number,
  payload: ShareSnapshotInput
): Promise<UpsertShareSnapshotResult> {
  const recentFoods = payload.recentFoods.slice(0, 3);
  const resolvedExpiresAt = resolveShareSnapshotExpiresAt(payload.expiresAt);

  const result = await query<{ share_id: string; expires_at: string | null }>(
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
      RETURNING
        share_id,
        CASE WHEN expires_at IS NULL THEN NULL ELSE expires_at::text END AS expires_at;
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
      resolvedExpiresAt
    ]
  );

  const row = result.rows[0];
  if (result.rowCount !== 1 || !row) {
    throw new Error("Share ID already exists for another user.");
  }

  return {
    shareId: row.share_id,
    expiresAt: row.expires_at
  };
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
