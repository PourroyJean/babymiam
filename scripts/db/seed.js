#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { resolveDatabaseUrl, getEnvValue, isStrictRuntime } = require("./_db-url");

const DEMO_CATEGORY_COUNT = 9;
const DEMO_FOODS_PER_CATEGORY = 5;

const DEMO_FOOD_PROFILES = [
  {
    finalPreference: 0,
    progressNote: "1/3 bon depart",
    tastings: [{ liked: true, textureLevel: 1, reactionType: 0, note: "ok puree" }]
  },
  {
    finalPreference: 0,
    progressNote: "2/3 en cours",
    tastings: [
      { liked: true, textureLevel: 1, reactionType: 0, note: "ok debut" },
      { liked: true, textureLevel: 2, reactionType: 0, note: "ok encore" }
    ]
  },
  {
    finalPreference: 1,
    progressNote: "3/3 valide",
    tastings: [
      { liked: true, textureLevel: 1, reactionType: 0, note: "ok 1" },
      { liked: true, textureLevel: 2, reactionType: 0, note: "ok 2" },
      { liked: true, textureLevel: 3, reactionType: 0, note: "ok 3" }
    ]
  },
  {
    finalPreference: 0,
    progressNote: "3/3 mitige",
    tastings: [
      { liked: true, textureLevel: 1, reactionType: 0, note: "ok 1" },
      { liked: null, textureLevel: 2, reactionType: 1, note: "a surveiller" },
      { liked: true, textureLevel: 3, reactionType: 0, note: "mieux" }
    ]
  },
  {
    finalPreference: -1,
    progressNote: "3/3 a retenter",
    tastings: [
      { liked: false, textureLevel: 2, reactionType: 1, note: "grimace" },
      { liked: false, textureLevel: 2, reactionType: 1, note: "refus" },
      { liked: false, textureLevel: 3, reactionType: 2, note: "stop" }
    ]
  }
];

function shouldSkipSeed() {
  if (getEnvValue("SKIP_DB_SETUP") !== "1") return false;

  if (isStrictRuntime()) {
    throw new Error("[db:seed] Refusing to skip seed in production/CI. Remove SKIP_DB_SETUP=1.");
  }

  console.log("[db:seed] Skipped (SKIP_DB_SETUP=1).");
  return true;
}

async function readSourceCategories() {
  const sourcePath = path.join(process.cwd(), "aliments_categories.json");
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.categories) ? parsed.categories : [];
}

function normalizeFoodName(value) {
  return String(value || "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toUtcDateOnly(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function shiftDateDays(dateValue, days) {
  const date = toUtcDateOnly(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function formatDateIso(dateValue) {
  return toUtcDateOnly(dateValue).toISOString().slice(0, 10);
}

function selectDemoFoodsByCategory(rows, expectedCategoryCount = DEMO_CATEGORY_COUNT, foodsPerCategory = DEMO_FOODS_PER_CATEGORY) {
  const sortedRows = [...rows].sort((left, right) => {
    if (left.categorySortOrder !== right.categorySortOrder) {
      return left.categorySortOrder - right.categorySortOrder;
    }

    if (left.categoryId !== right.categoryId) {
      return left.categoryId - right.categoryId;
    }

    if (left.foodSortOrder !== right.foodSortOrder) {
      return left.foodSortOrder - right.foodSortOrder;
    }

    return left.foodId - right.foodId;
  });

  const byCategory = new Map();
  for (const row of sortedRows) {
    if (!byCategory.has(row.categoryId)) {
      byCategory.set(row.categoryId, {
        categoryId: row.categoryId,
        categorySortOrder: row.categorySortOrder,
        foods: []
      });
    }

    byCategory.get(row.categoryId).foods.push({
      foodId: row.foodId,
      foodSortOrder: row.foodSortOrder
    });
  }

  if (byCategory.size !== expectedCategoryCount) {
    throw new Error(
      `[db:seed] Demo dataset expects ${expectedCategoryCount} categories but found ${byCategory.size}.`
    );
  }

  const categoryGroups = [...byCategory.values()].sort((left, right) => {
    if (left.categorySortOrder !== right.categorySortOrder) {
      return left.categorySortOrder - right.categorySortOrder;
    }
    return left.categoryId - right.categoryId;
  });

  const selected = [];
  for (let categoryIndex = 0; categoryIndex < categoryGroups.length; categoryIndex += 1) {
    const group = categoryGroups[categoryIndex];
    if (group.foods.length < foodsPerCategory) {
      throw new Error(
        `[db:seed] Category ${group.categoryId} has ${group.foods.length} global foods. Expected at least ${foodsPerCategory}.`
      );
    }

    for (let foodIndex = 0; foodIndex < foodsPerCategory; foodIndex += 1) {
      selected.push({
        categoryId: group.categoryId,
        categoryIndex,
        foodId: group.foods[foodIndex].foodId,
        foodIndex
      });
    }
  }

  return selected;
}

function buildDemoSeedDataset(selectedFoods, today = new Date()) {
  const todayDate = toUtcDateOnly(today);
  const progressRows = [];
  const tastingRows = [];

  for (const selectedFood of selectedFoods) {
    const profile = DEMO_FOOD_PROFILES[selectedFood.foodIndex];
    if (!profile) {
      throw new Error(`[db:seed] Missing demo profile for foodIndex=${selectedFood.foodIndex}.`);
    }

    const anchorOffset = selectedFood.categoryIndex * 6 + selectedFood.foodIndex * 2;
    const anchorDate = shiftDateDays(todayDate, -anchorOffset);
    const tastingCount = profile.tastings.length;
    const firstTastedOn = shiftDateDays(anchorDate, -(tastingCount - 1));

    progressRows.push({
      foodId: selectedFood.foodId,
      finalPreference: profile.finalPreference,
      note: profile.progressNote,
      exposureCount: tastingCount,
      firstTastedOn: formatDateIso(firstTastedOn)
    });

    for (let slotIndex = 0; slotIndex < tastingCount; slotIndex += 1) {
      const tasting = profile.tastings[slotIndex];
      tastingRows.push({
        foodId: selectedFood.foodId,
        slot: slotIndex + 1,
        liked: tasting.liked,
        tastedOn: formatDateIso(shiftDateDays(firstTastedOn, slotIndex)),
        note: tasting.note,
        textureLevel: tasting.textureLevel,
        reactionType: tasting.reactionType
      });
    }
  }

  return {
    progressRows,
    tastingRows
  };
}

async function upsertSourceCategoriesAndFoods(client, sourceCategories) {
  for (let c = 0; c < sourceCategories.length; c += 1) {
    const category = sourceCategories[c];
    const categoryName = String(category.categorie || "").trim();
    const foods = Array.isArray(category.aliments) ? category.aliments : [];

    if (!categoryName) continue;

    const categoryRes = await client.query(
      `
      INSERT INTO categories (name, sort_order)
      VALUES ($1, $2)
      ON CONFLICT (name)
      DO UPDATE SET sort_order = EXCLUDED.sort_order
      RETURNING id;
      `,
      [categoryName, c]
    );

    if (!categoryRes.rows[0]) continue;
    const categoryId = Number(categoryRes.rows[0].id);

    for (let i = 0; i < foods.length; i += 1) {
      const foodName = String(foods[i] || "").trim();
      if (!foodName) continue;

      await client.query(
        `
        INSERT INTO foods (category_id, owner_id, name, normalized_name, sort_order)
        VALUES ($1, NULL, $2, $3, $4)
        ON CONFLICT (category_id, normalized_name)
        WHERE owner_id IS NULL
        DO UPDATE SET sort_order = EXCLUDED.sort_order;
        `,
        [categoryId, foodName, normalizeFoodName(foodName), i]
      );
    }
  }
}

async function loadGlobalFoodsForDemo(client) {
  const result = await client.query(
    `
      SELECT
        c.id AS category_id,
        c.sort_order AS category_sort_order,
        f.id AS food_id,
        f.sort_order AS food_sort_order
      FROM categories c
      INNER JOIN foods f ON f.category_id = c.id
      WHERE f.owner_id IS NULL
      ORDER BY
        c.sort_order ASC,
        c.id ASC,
        f.sort_order ASC,
        f.id ASC;
    `
  );

  return result.rows.map((row) => ({
    categoryId: Number(row.category_id),
    categorySortOrder: Number(row.category_sort_order),
    foodId: Number(row.food_id),
    foodSortOrder: Number(row.food_sort_order)
  }));
}

async function seedPersonalDemoData({
  pool,
  ownerId,
  expectedCategoryCount = DEMO_CATEGORY_COUNT,
  foodsPerCategory = DEMO_FOODS_PER_CATEGORY,
  today = new Date()
}) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await client.query("DELETE FROM food_tastings WHERE owner_id = $1;", [ownerId]);
    await client.query("DELETE FROM food_progress WHERE owner_id = $1;", [ownerId]);
    await client.query("DELETE FROM foods WHERE owner_id = $1;", [ownerId]);

    const globalFoods = await loadGlobalFoodsForDemo(client);
    const selectedFoods = selectDemoFoodsByCategory(globalFoods, expectedCategoryCount, foodsPerCategory);
    const dataset = buildDemoSeedDataset(selectedFoods, today);

    for (const progress of dataset.progressRows) {
      await client.query(
        `
          INSERT INTO food_progress (
            owner_id,
            food_id,
            final_preference,
            note,
            exposure_count,
            first_tasted_on,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::date, NOW())
          ON CONFLICT (owner_id, food_id)
          DO UPDATE SET
            final_preference = EXCLUDED.final_preference,
            note = EXCLUDED.note,
            exposure_count = EXCLUDED.exposure_count,
            first_tasted_on = EXCLUDED.first_tasted_on,
            updated_at = NOW();
        `,
        [
          ownerId,
          progress.foodId,
          progress.finalPreference,
          progress.note,
          progress.exposureCount,
          progress.firstTastedOn
        ]
      );
    }

    for (const tasting of dataset.tastingRows) {
      await client.query(
        `
          INSERT INTO food_tastings (
            owner_id,
            food_id,
            slot,
            liked,
            tasted_on,
            note,
            texture_level,
            reaction_type,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, NOW())
          ON CONFLICT (owner_id, food_id, slot)
          DO UPDATE SET
            liked = EXCLUDED.liked,
            tasted_on = EXCLUDED.tasted_on,
            note = EXCLUDED.note,
            texture_level = EXCLUDED.texture_level,
            reaction_type = EXCLUDED.reaction_type,
            updated_at = NOW();
        `,
        [
          ownerId,
          tasting.foodId,
          tasting.slot,
          tasting.liked,
          tasting.tastedOn,
          tasting.note,
          tasting.textureLevel,
          tasting.reactionType
        ]
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      selectedFoodsCount: selectedFoods.length,
      progressRowsCount: dataset.progressRows.length,
      tastingRowsCount: dataset.tastingRows.length
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function runSeed() {
  if (shouldSkipSeed()) {
    return;
  }

  const { Pool } = require("pg");
  const { ensurePersonalAccess } = require("../users/ensure-personal-access");
  const { databaseUrl } = resolveDatabaseUrl({ scriptName: "db:seed" });
  const sourceCategories = await readSourceCategories();
  const pool = new Pool({
    connectionString: databaseUrl
  });
  try {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;
      await upsertSourceCategoriesAndFoods(client, sourceCategories);
      await client.query("COMMIT");
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }

    const user = await ensurePersonalAccess({
      env: process.env,
      databaseUrl
    });

    const demoStats = await seedPersonalDemoData({
      pool,
      ownerId: user.id,
      expectedCategoryCount: DEMO_CATEGORY_COUNT,
      foodsPerCategory: DEMO_FOODS_PER_CATEGORY
    });

    console.log("[db:seed] Seed completed.");
    console.log("[db:seed] Personal access ensured:", user);
    console.log("[db:seed] Personal demo data refreshed:", demoStats);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runSeed().catch((error) => {
    console.error("[db:seed] Failed:", error);
    process.exit(1);
  });
}

module.exports = {
  DEMO_CATEGORY_COUNT,
  DEMO_FOODS_PER_CATEGORY,
  DEMO_FOOD_PROFILES,
  normalizeFoodName,
  formatDateIso,
  shiftDateDays,
  selectDemoFoodsByCategory,
  buildDemoSeedDataset,
  seedPersonalDemoData,
  runSeed
};
