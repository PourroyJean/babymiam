#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");

const LOCAL_POSTGRES_URL = "postgres://postgres:postgres@localhost:5432/babymiam";

function getConnectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || LOCAL_POSTGRES_URL;
}

async function readSourceCategories() {
  const sourcePath = path.join(process.cwd(), "aliments_categories.json");
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.categories) ? parsed.categories : [];
}

async function runSeed() {
  if (process.env.SKIP_DB_SETUP === "1") {
    console.log("[db:seed] Skipped (SKIP_DB_SETUP=1).");
    return;
  }

  const sourceCategories = await readSourceCategories();
  const pool = new Pool({
    connectionString: getConnectionString()
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
          INSERT INTO foods (category_id, name, sort_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (category_id, name)
          DO UPDATE SET sort_order = EXCLUDED.sort_order;
          `,
          [categoryId, foodName, i]
        );
      }
    }

    await client.query("COMMIT");
    console.log("[db:seed] Seed completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((error) => {
  console.error("[db:seed] Failed:", error);
  process.exit(1);
});
