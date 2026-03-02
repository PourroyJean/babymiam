const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEMO_CATEGORY_COUNT,
  DEMO_FOODS_PER_CATEGORY,
  selectDemoFoodsByCategory,
  buildDemoSeedDataset
} = require("./seed");

function buildFixtureRows({ categoryCount = DEMO_CATEGORY_COUNT, foodsPerCategory = 7 } = {}) {
  const rows = [];

  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex += 1) {
    const categoryId = categoryIndex + 1;
    for (let foodSortOrder = 0; foodSortOrder < foodsPerCategory; foodSortOrder += 1) {
      rows.push({
        categoryId,
        categorySortOrder: categoryIndex,
        foodId: categoryId * 100 + foodSortOrder,
        foodSortOrder
      });
    }
  }

  return rows.reverse();
}

test("selectDemoFoodsByCategory picks the first five foods per category by sort order", () => {
  const rows = buildFixtureRows();
  const selected = selectDemoFoodsByCategory(rows, DEMO_CATEGORY_COUNT, DEMO_FOODS_PER_CATEGORY);

  assert.equal(selected.length, DEMO_CATEGORY_COUNT * DEMO_FOODS_PER_CATEGORY);

  for (let categoryIndex = 0; categoryIndex < DEMO_CATEGORY_COUNT; categoryIndex += 1) {
    const categoryId = categoryIndex + 1;
    const categoryRows = selected.filter((entry) => entry.categoryId === categoryId);

    assert.equal(categoryRows.length, DEMO_FOODS_PER_CATEGORY);
    for (let foodIndex = 0; foodIndex < DEMO_FOODS_PER_CATEGORY; foodIndex += 1) {
      const row = categoryRows[foodIndex];
      assert.equal(row.categoryIndex, categoryIndex);
      assert.equal(row.foodIndex, foodIndex);
      assert.equal(row.foodId, categoryId * 100 + foodIndex);
    }
  }
});

test("buildDemoSeedDataset creates deterministic counts and distributions", () => {
  const selected = selectDemoFoodsByCategory(buildFixtureRows(), DEMO_CATEGORY_COUNT, DEMO_FOODS_PER_CATEGORY);
  const dataset = buildDemoSeedDataset(selected, new Date("2026-03-02T12:34:56.000Z"));

  assert.equal(dataset.progressRows.length, 45);
  assert.equal(dataset.tastingRows.length, 108);

  const slotCounts = new Map([
    [1, 0],
    [2, 0],
    [3, 0]
  ]);
  for (const row of dataset.tastingRows) {
    slotCounts.set(row.slot, Number(slotCounts.get(row.slot) || 0) + 1);
  }

  assert.equal(slotCounts.get(1), 45);
  assert.equal(slotCounts.get(2), 36);
  assert.equal(slotCounts.get(3), 27);

  const preferenceCounts = new Map([
    [-1, 0],
    [0, 0],
    [1, 0]
  ]);
  for (const row of dataset.progressRows) {
    preferenceCounts.set(row.finalPreference, Number(preferenceCounts.get(row.finalPreference) || 0) + 1);
  }

  assert.equal(preferenceCounts.get(1), 9);
  assert.equal(preferenceCounts.get(0), 27);
  assert.equal(preferenceCounts.get(-1), 9);

  const firstFoodRows = dataset.tastingRows.filter((row) => row.foodId === 100);
  assert.deepEqual(
    firstFoodRows.map((row) => row.tastedOn),
    ["2026-03-02"]
  );

  const category1Food4Rows = dataset.tastingRows.filter((row) => row.foodId === 204);
  assert.deepEqual(
    category1Food4Rows.map((row) => row.tastedOn),
    ["2026-02-14", "2026-02-15", "2026-02-16"]
  );
});

test("selectDemoFoodsByCategory fails when expected category count is not met", () => {
  const rows = buildFixtureRows({ categoryCount: DEMO_CATEGORY_COUNT - 1 });
  assert.throws(
    () => selectDemoFoodsByCategory(rows, DEMO_CATEGORY_COUNT, DEMO_FOODS_PER_CATEGORY),
    /expects 9 categories/
  );
});
