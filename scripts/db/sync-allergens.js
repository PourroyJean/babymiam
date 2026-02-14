#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";
const ALLERGEN_CATEGORY_NAME = "Allergènes majeurs";
const EXPECTED_ALLERGEN_COUNT = 14;

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || LOCAL_POSTGRES_URL;
}

async function readAllergenSource() {
  const sourcePath = path.join(process.cwd(), "aliments_categories.json");
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw);
  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];

  const categoryIndex = categories.findIndex(
    (entry) => String(entry?.categorie || "").trim() === ALLERGEN_CATEGORY_NAME
  );

  if (categoryIndex < 0) {
    throw new Error(`Catégorie introuvable dans aliments_categories.json: ${ALLERGEN_CATEGORY_NAME}`);
  }

  const allergenEntry = categories[categoryIndex];
  const rawFoods = Array.isArray(allergenEntry?.aliments) ? allergenEntry.aliments : [];

  const allergenFoods = rawFoods
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (allergenFoods.length !== EXPECTED_ALLERGEN_COUNT) {
    throw new Error(
      `La catégorie ${ALLERGEN_CATEGORY_NAME} doit contenir ${EXPECTED_ALLERGEN_COUNT} aliments (actuel: ${allergenFoods.length}).`
    );
  }

  const uniqueFoods = new Set(allergenFoods);
  if (uniqueFoods.size !== allergenFoods.length) {
    throw new Error(`La catégorie ${ALLERGEN_CATEGORY_NAME} contient des doublons.`);
  }

  return {
    categorySortOrder: categoryIndex,
    allergenFoods
  };
}

async function runSync() {
  if (process.env.SKIP_DB_SETUP === "1") {
    console.log("[db:sync-allergens] Skipped (SKIP_DB_SETUP=1).");
    return;
  }

  const { categorySortOrder, allergenFoods } = await readAllergenSource();

  const pool = new Pool({
    connectionString: getConnectionString()
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const categoryResult = await client.query(
      `
        INSERT INTO categories (name, sort_order)
        VALUES ($1, $2)
        ON CONFLICT (name)
        DO UPDATE SET sort_order = EXCLUDED.sort_order
        RETURNING id;
      `,
      [ALLERGEN_CATEGORY_NAME, categorySortOrder]
    );

    const categoryId = Number(categoryResult.rows[0]?.id);
    if (!Number.isFinite(categoryId)) {
      throw new Error(`Impossible de récupérer l'ID pour la catégorie ${ALLERGEN_CATEGORY_NAME}.`);
    }

    for (let index = 0; index < allergenFoods.length; index += 1) {
      const foodName = allergenFoods[index];
      await client.query(
        `
          INSERT INTO foods (category_id, name, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (category_id, name)
          DO UPDATE SET sort_order = EXCLUDED.sort_order;
        `,
        [categoryId, foodName, index]
      );
    }

    const deleteResult = await client.query(
      `
        DELETE FROM foods
        WHERE category_id = $1
          AND NOT (name = ANY($2::text[]));
      `,
      [categoryId, allergenFoods]
    );

    await client.query("COMMIT");

    console.log(
      `[db:sync-allergens] Sync completed. ${allergenFoods.length} allergènes conservés, ${deleteResult.rowCount || 0} supprimés.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSync().catch((error) => {
  console.error("[db:sync-allergens] Failed:", error);
  process.exit(1);
});
