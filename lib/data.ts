import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db";
import type {
  AccountPublicShareLink,
  ChildProfile,
  DashboardCategory,
  FoodTastingEntry,
  FoodTimelineEntry
} from "@/lib/types";
import { getPublicShareLinkExpiresAtEpochSeconds } from "@/lib/public-share-token";
import {
  DEFAULT_TEXTURE_LEVEL,
  isTextureLevel,
  type ReactionType,
  type TextureLevel
} from "@/lib/tasting-metadata";
import { normalizeSearchValue } from "@/lib/ui-utils";

export type EventVisibility = "private" | "public";

type DeleteTastingResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

type AppendQuickEntryInput = {
  foodId: number;
  tastedOn: string;
  liked: boolean | null;
  note: string;
  textureLevel: TextureLevel;
  reactionType: ReactionType | null;
};

export type SaveFoodSummaryInput = {
  slot: 1 | 2 | 3;
  liked: boolean | null;
  tastedOn: string;
  note: string;
  textureLevel: TextureLevel;
  reactionType: ReactionType;
};

export type AppendQuickEntryResult = {
  status: "ok" | "maxed" | "food_not_found" | "unavailable";
};

export type CreateUserFoodResult =
  | { status: "created"; foodId: number }
  | { status: "invalid_name" | "category_not_found" | "duplicate" };

export type DeleteUserFoodResult = { status: "deleted" | "forbidden_or_not_found" };

type FoodProgressColumns = {
  hasExposureCount: boolean;
  hasFirstTastedOn: boolean;
  hasNote: boolean;
  hasUpdatedAt: boolean;
};

type AccessibleFoodRow = {
  food_id: number;
  category_id: number;
  sort_order: number;
  owner_id: number | null;
};

const SHARE_OPEN_DEDUPE_MINUTES = 5;
const SHARE_OPEN_DEDUPE_LOCK_NAMESPACE = 18427;
const PUBLIC_SHARE_ID_BYTE_LENGTH = 24;
const PUBLIC_SHARE_ID_GENERATION_RETRIES = 5;

export type PublicShareLinkState = {
  ownerId: number;
  publicId: string;
  issuedAt: string;
  expiresAt: string;
};

function createPublicShareId() {
  return crypto.randomBytes(PUBLIC_SHARE_ID_BYTE_LENGTH).toString("base64url");
}

function getEpochSeconds(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed / 1000);
}

function isExpiredTimestamp(value: string | null) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return true;
  return parsed <= Date.now();
}

function mapPublicShareLinkRow(row: {
  owner_id: number;
  public_id: string;
  issued_at: string;
  expires_at: string;
}): PublicShareLinkState {
  return {
    ownerId: Number(row.owner_id),
    publicId: row.public_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at
  };
}

function normalizeFoodName(value: string) {
  return normalizeSearchValue(value);
}

function normalizeFoodLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "23505";
}

function isUndefinedColumnError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "42703";
}

let foodProgressColumnsCache: FoodProgressColumns | null = null;
let foodProgressColumnsCachedAt = 0;
let foodProgressColumnsInFlight: Promise<FoodProgressColumns> | null = null;
const FOOD_PROGRESS_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;

function resetFoodProgressColumnsCache() {
  foodProgressColumnsCache = null;
  foodProgressColumnsCachedAt = 0;
  foodProgressColumnsInFlight = null;
}

async function getAccessibleFoodById(
  client: Pick<PoolClient, "query">,
  ownerId: number,
  foodId: number
): Promise<AccessibleFoodRow | null> {
  const result = await client.query<AccessibleFoodRow>(
    `
      SELECT
        id AS food_id,
        category_id,
        sort_order,
        owner_id
      FROM foods
      WHERE id = $1
        AND (owner_id IS NULL OR owner_id = $2)
      LIMIT 1;
    `,
    [foodId, ownerId]
  );

  return result.rows[0] ?? null;
}

async function queryFoodProgressColumns(client: PoolClient): Promise<FoodProgressColumns> {
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

async function getCachedFoodProgressColumns(client: PoolClient): Promise<FoodProgressColumns> {
  const now = Date.now();
  const isFresh =
    foodProgressColumnsCache !== null && now - foodProgressColumnsCachedAt < FOOD_PROGRESS_COLUMNS_CACHE_TTL_MS;

  if (isFresh && foodProgressColumnsCache) {
    return foodProgressColumnsCache;
  }

  if (!foodProgressColumnsInFlight) {
    foodProgressColumnsInFlight = queryFoodProgressColumns(client)
      .then((columns) => {
        foodProgressColumnsCache = columns;
        foodProgressColumnsCachedAt = Date.now();
        return columns;
      })
      .finally(() => {
        foodProgressColumnsInFlight = null;
      });
  }

  return foodProgressColumnsInFlight;
}

async function applyQuickEntryProgressUpdate(
  client: PoolClient,
  ownerId: number,
  foodId: number,
  tastedOn: string,
  nextExposureCount: number
) {
  const runWithCache = async () => {
    const progressColumns = await getCachedFoodProgressColumns(client);
    const updateParams: unknown[] = [ownerId, foodId];
    const setClauses: string[] = [];

    if (progressColumns.hasExposureCount) {
      const exposureRef = `$${updateParams.push(nextExposureCount)}`;
      setClauses.push(`exposure_count = ${exposureRef}`);
    }

    if (progressColumns.hasFirstTastedOn) {
      const tastedOnRef = `$${updateParams.push(tastedOn)}`;
      setClauses.push(`first_tasted_on = COALESCE(food_progress.first_tasted_on, ${tastedOnRef}::date)`);
    }

    if (progressColumns.hasUpdatedAt) {
      setClauses.push("updated_at = NOW()");
    }

    if (setClauses.length === 0) return;

    await client.query(
      `
        UPDATE food_progress
        SET ${setClauses.join(", ")}
        WHERE owner_id = $1
          AND food_id = $2;
      `,
      updateParams
    );
  };

  try {
    await runWithCache();
  } catch (error) {
    if (!isUndefinedColumnError(error)) {
      throw error;
    }

    resetFoodProgressColumnsCache();
    await runWithCache();
  }
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

    const food = await getAccessibleFoodById(client, ownerId, payload.foodId);
    if (!food) {
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
    await applyQuickEntryProgressUpdate(client, ownerId, payload.foodId, payload.tastedOn, nextExposureCount);

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
    is_user_owned: boolean;
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
        (f.owner_id = $1) AS is_user_owned,
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
      WHERE f.owner_id IS NULL OR f.owner_id = $1
      ORDER BY
        c.sort_order,
        f.normalized_name,
        f.id;
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
            const textureLevel = isTextureLevel(rawTextureLevel) ? rawTextureLevel : DEFAULT_TEXTURE_LEVEL;
            const reactionType =
              typeof rawReactionType === "number" && [0, 1, 2, 3, 4].includes(rawReactionType)
                ? (rawReactionType as ReactionType)
                : null;

            if (![1, 2, 3].includes(slot)) return null;
            if (liked !== null && typeof liked !== "boolean") return null;
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
      isUserOwned: Boolean(row.is_user_owned),
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
    liked: boolean | null;
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
        AND (f.owner_id IS NULL OR f.owner_id = $1)
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
        liked: typeof row.liked === "boolean" ? row.liked : null,
        note: row.note ?? "",
        textureLevel: isTextureLevel(row.texture_level) ? row.texture_level : DEFAULT_TEXTURE_LEVEL,
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
  liked: boolean | null,
  tastedOn: string,
  note: string,
  textureLevel: TextureLevel,
  reactionType: ReactionType | null
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const food = await getAccessibleFoodById(client, ownerId, foodId);
    if (!food) {
      await client.query("ROLLBACK");
      return false;
    }

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
    return true;
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

    const food = await getAccessibleFoodById(client, ownerId, foodId);
    if (!food) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Aliment introuvable." };
    }

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
): Promise<-1 | 0 | 1 | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const food = await getAccessibleFoodById(client, ownerId, foodId);
    if (!food) {
      await client.query("ROLLBACK");
      return null;
    }

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

export async function saveFoodSummary(
  ownerId: number,
  foodId: number,
  note: string,
  tastings: SaveFoodSummaryInput[]
): Promise<boolean> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const food = await getAccessibleFoodById(client, ownerId, foodId);
    if (!food) {
      await client.query("ROLLBACK");
      return false;
    }

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
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createUserFood(
  ownerId: number,
  categoryId: number,
  nameInput: string
): Promise<CreateUserFoodResult> {
  const name = normalizeFoodLabel(nameInput);
  if (!name) {
    return { status: "invalid_name" };
  }

  const normalizedTarget = normalizeFoodName(name);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const categoryResult = await client.query<{ id: number }>(
      `
        SELECT id
        FROM categories
        WHERE id = $1
        LIMIT 1;
      `,
      [categoryId]
    );
    if (!categoryResult.rowCount) {
      await client.query("ROLLBACK");
      return { status: "category_not_found" };
    }

    const duplicateCheck = await client.query<{ id: number }>(
      `
        SELECT id
        FROM foods
        WHERE category_id = $1
          AND (owner_id IS NULL OR owner_id = $2)
          AND normalized_name = $3
        LIMIT 1;
      `,
      [categoryId, ownerId, normalizedTarget]
    );

    if (duplicateCheck.rowCount) {
      await client.query("ROLLBACK");
      return { status: "duplicate" };
    }

    const sortOrderResult = await client.query<{ max_sort_order: number }>(
      `
        SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort_order
        FROM foods
        WHERE category_id = $1;
      `,
      [categoryId]
    );
    const nextSortOrder = Number(sortOrderResult.rows[0]?.max_sort_order ?? -1) + 1;

    const insertResult = await client.query<{ id: number }>(
      `
        INSERT INTO foods (category_id, owner_id, name, normalized_name, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `,
      [categoryId, ownerId, name, normalizedTarget, nextSortOrder]
    );

    await client.query("COMMIT");
    return {
      status: "created",
      foodId: Number(insertResult.rows[0]?.id)
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      return { status: "duplicate" };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUserFood(ownerId: number, foodId: number): Promise<DeleteUserFoodResult> {
  const result = await query<{ id: number }>(
    `
      DELETE FROM foods
      WHERE id = $1
        AND owner_id = $2
      RETURNING id;
    `,
    [foodId, ownerId]
  );

  return {
    status: result.rowCount === 1 ? "deleted" : "forbidden_or_not_found"
  };
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

export async function createPublicShareLinkOpenEvent(
  ownerId: number,
  publicId: string,
  metadata: Record<string, unknown>
) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        SELECT pg_advisory_xact_lock($1::int, hashtext($2));
      `,
      [SHARE_OPEN_DEDUPE_LOCK_NAMESPACE, `${ownerId}:${publicId}`]
    );

    const existingResult = await client.query(
      `
        SELECT 1
        FROM growth_events
        WHERE owner_id = $1
          AND event_name = 'public_share_link_opened'
          AND channel = 'public_page'
          AND visibility = 'public'
          AND metadata->>'publicId' = $2
          AND created_at > NOW() - INTERVAL '${SHARE_OPEN_DEDUPE_MINUTES} minutes'
        LIMIT 1;
      `,
      [ownerId, publicId]
    );

    if (Number(existingResult.rowCount || 0) > 0) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(
      `
        INSERT INTO growth_events (owner_id, event_name, channel, visibility, metadata)
        VALUES ($1, $2, $3, $4::event_visibility, $5::jsonb);
      `,
      [ownerId, "public_share_link_opened", "public_page", "public", JSON.stringify(metadata)]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and surface the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getActivePublicShareLinkForOwner(ownerId: number): Promise<PublicShareLinkState | null> {
  const result = await query<{
    owner_id: number;
    public_id: string;
    issued_at: string;
    expires_at: string;
  }>(
    `
      SELECT
        public_share_links.owner_id,
        public_share_links.public_id,
        public_share_links.issued_at::text AS issued_at,
        public_share_links.expires_at::text AS expires_at
      FROM public_share_links
      INNER JOIN users ON users.id = public_share_links.owner_id
      WHERE public_share_links.owner_id = $1
        AND public_share_links.expires_at > NOW()
        AND users.status = 'active'
        AND users.email_verified_at IS NOT NULL
      LIMIT 1;
    `,
    [ownerId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapPublicShareLinkRow(row);
}

export async function getPublicShareLinkByPublicId(publicId: string): Promise<PublicShareLinkState | null> {
  const result = await query<{
    owner_id: number;
    public_id: string;
    issued_at: string;
    expires_at: string;
  }>(
    `
      SELECT
        public_share_links.owner_id,
        public_share_links.public_id,
        public_share_links.issued_at::text AS issued_at,
        public_share_links.expires_at::text AS expires_at
      FROM public_share_links
      INNER JOIN users ON users.id = public_share_links.owner_id
      WHERE public_share_links.public_id = $1
        AND public_share_links.expires_at > NOW()
        AND users.status = 'active'
        AND users.email_verified_at IS NOT NULL
      LIMIT 1;
    `,
    [publicId]
  );

  const row = result.rows[0];
  if (!row) return null;
  return mapPublicShareLinkRow(row);
}

export async function createOrRotatePublicShareLink(
  ownerId: number,
  options: { forceRotate?: boolean } = {}
): Promise<PublicShareLinkState> {
  const existingLink = await getActivePublicShareLinkForOwner(ownerId);
  if (existingLink && !options.forceRotate) {
    return existingLink;
  }

  for (let attempt = 0; attempt < PUBLIC_SHARE_ID_GENERATION_RETRIES; attempt += 1) {
    const publicId = createPublicShareId();
    const issuedAtEpochSeconds = Math.floor(Date.now() / 1000);
    const issuedAt = new Date(issuedAtEpochSeconds * 1000).toISOString();
    const expiresAtEpochSeconds = getPublicShareLinkExpiresAtEpochSeconds(issuedAtEpochSeconds);
    if (!expiresAtEpochSeconds) {
      throw new Error("Failed to resolve public share link expiry.");
    }

    const expiresAt = new Date(expiresAtEpochSeconds * 1000).toISOString();

    try {
      const result = await query<{
        owner_id: number;
        public_id: string;
        issued_at: string;
        expires_at: string;
      }>(
        `
          INSERT INTO public_share_links (owner_id, public_id, issued_at, expires_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (owner_id)
          DO UPDATE SET
            public_id = EXCLUDED.public_id,
            issued_at = EXCLUDED.issued_at,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
          RETURNING
            owner_id,
            public_id,
            issued_at::text AS issued_at,
            expires_at::text AS expires_at;
        `,
        [ownerId, publicId, issuedAt, expiresAt]
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("Failed to persist public share link.");
      }

      return mapPublicShareLinkRow(row);
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error("Failed to create a unique public share link.");
}

export function buildAccountPublicShareLink(params: {
  baseUrl: string;
  token: string;
  link: PublicShareLinkState;
}): AccountPublicShareLink {
  return {
    url: `${params.baseUrl}/share/${encodeURIComponent(params.token)}`,
    expiresAt: params.link.expiresAt
  };
}

export function isPublicShareLinkTokenCurrent(params: {
  link: PublicShareLinkState | null;
  publicId: string;
  issuedAtEpochSeconds: number;
}) {
  if (!params.link) return false;
  if (params.link.publicId !== params.publicId) return false;
  if (isExpiredTimestamp(params.link.expiresAt)) return false;

  const issuedAtEpochSeconds = getEpochSeconds(params.link.issuedAt);
  if (!issuedAtEpochSeconds) return false;
  return issuedAtEpochSeconds === params.issuedAtEpochSeconds;
}
