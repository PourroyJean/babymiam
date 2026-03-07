-- Up Migration

CREATE TEMP TABLE food_name_canonicalization (
  category_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  alternate_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO food_name_canonicalization (category_name, canonical_name, alternate_name)
VALUES
  ('Allergènes majeurs', 'Oeufs', 'Œufs'),
  ('Protéines animales', 'Oeuf (bien cuit)', 'Œuf (bien cuit)');

INSERT INTO foods (category_id, owner_id, name, normalized_name, sort_order)
SELECT
  c.id,
  NULL,
  mapping.canonical_name,
  btrim(
    regexp_replace(
      translate(
        replace(
          replace(lower(mapping.canonical_name), 'œ', 'oe'),
          'æ',
          'ae'
        ),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
        'aaaaaaceeeeiiiinooooouuuuyy'
      ),
      '\s+',
      ' ',
      'g'
    )
  ),
  MIN(existing_food.sort_order)
FROM food_name_canonicalization AS mapping
INNER JOIN categories AS c
  ON c.name = mapping.category_name
INNER JOIN foods AS existing_food
  ON existing_food.category_id = c.id
 AND lower(existing_food.name) IN (lower(mapping.canonical_name), lower(mapping.alternate_name))
WHERE NOT EXISTS (
  SELECT 1
  FROM foods AS global_food
  WHERE global_food.category_id = c.id
    AND global_food.owner_id IS NULL
    AND lower(global_food.name) IN (lower(mapping.canonical_name), lower(mapping.alternate_name))
)
GROUP BY c.id, mapping.canonical_name;

CREATE TEMP TABLE food_ligature_groups ON COMMIT DROP AS
SELECT
  food.id AS food_id,
  food.category_id,
  food.owner_id,
  btrim(
    regexp_replace(
      translate(
        replace(
          replace(lower(food.name), 'œ', 'oe'),
          'æ',
          'ae'
        ),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
        'aaaaaaceeeeiiiinooooouuuuyy'
      ),
      '\s+',
      ' ',
      'g'
    )
  ) AS next_normalized_name
FROM foods AS food;

CREATE TEMP TABLE food_merge_sources ON COMMIT DROP AS
SELECT
  group_row.food_id AS source_food_id,
  COALESCE(
    (
      SELECT global_row.food_id
      FROM food_ligature_groups AS global_row
      WHERE global_row.category_id = group_row.category_id
        AND global_row.owner_id IS NULL
        AND global_row.next_normalized_name = group_row.next_normalized_name
      ORDER BY global_row.food_id ASC
      LIMIT 1
    ),
    (
      SELECT owner_row.food_id
      FROM food_ligature_groups AS owner_row
      WHERE owner_row.category_id = group_row.category_id
        AND owner_row.owner_id IS NOT DISTINCT FROM group_row.owner_id
        AND owner_row.next_normalized_name = group_row.next_normalized_name
      ORDER BY owner_row.food_id ASC
      LIMIT 1
    )
  ) AS target_food_id
FROM food_ligature_groups AS group_row
WHERE group_row.food_id <> COALESCE(
  (
    SELECT global_row.food_id
    FROM food_ligature_groups AS global_row
    WHERE global_row.category_id = group_row.category_id
      AND global_row.owner_id IS NULL
      AND global_row.next_normalized_name = group_row.next_normalized_name
    ORDER BY global_row.food_id ASC
    LIMIT 1
  ),
  (
    SELECT owner_row.food_id
    FROM food_ligature_groups AS owner_row
    WHERE owner_row.category_id = group_row.category_id
      AND owner_row.owner_id IS NOT DISTINCT FROM group_row.owner_id
      AND owner_row.next_normalized_name = group_row.next_normalized_name
    ORDER BY owner_row.food_id ASC
    LIMIT 1
  )
);

INSERT INTO food_tastings (
  owner_id,
  food_id,
  slot,
  liked,
  tasted_on,
  note,
  texture_level,
  reaction_type,
  created_at,
  updated_at
)
SELECT
  tasting.owner_id,
  source.target_food_id,
  tasting.slot,
  tasting.liked,
  tasting.tasted_on,
  tasting.note,
  tasting.texture_level,
  tasting.reaction_type,
  tasting.created_at,
  tasting.updated_at
FROM food_merge_sources AS source
INNER JOIN food_tastings AS tasting
  ON tasting.food_id = source.source_food_id
ON CONFLICT (owner_id, food_id, slot) DO UPDATE
SET
  liked = CASE
    WHEN food_tastings.updated_at >= EXCLUDED.updated_at THEN food_tastings.liked
    ELSE EXCLUDED.liked
  END,
  tasted_on = CASE
    WHEN food_tastings.updated_at >= EXCLUDED.updated_at THEN food_tastings.tasted_on
    ELSE EXCLUDED.tasted_on
  END,
  note = CASE
    WHEN btrim(food_tastings.note) <> '' AND btrim(EXCLUDED.note) = '' THEN food_tastings.note
    WHEN btrim(food_tastings.note) = '' AND btrim(EXCLUDED.note) <> '' THEN EXCLUDED.note
    WHEN food_tastings.updated_at >= EXCLUDED.updated_at THEN food_tastings.note
    ELSE EXCLUDED.note
  END,
  texture_level = CASE
    WHEN food_tastings.updated_at >= EXCLUDED.updated_at THEN food_tastings.texture_level
    ELSE EXCLUDED.texture_level
  END,
  reaction_type = CASE
    WHEN food_tastings.updated_at >= EXCLUDED.updated_at THEN food_tastings.reaction_type
    ELSE EXCLUDED.reaction_type
  END,
  created_at = LEAST(food_tastings.created_at, EXCLUDED.created_at),
  updated_at = GREATEST(food_tastings.updated_at, EXCLUDED.updated_at);

INSERT INTO food_progress (
  owner_id,
  food_id,
  final_preference,
  note,
  updated_at,
  exposure_count,
  first_tasted_on
)
SELECT
  progress.owner_id,
  source.target_food_id,
  progress.final_preference,
  progress.note,
  progress.updated_at,
  progress.exposure_count,
  progress.first_tasted_on
FROM food_merge_sources AS source
INNER JOIN food_progress AS progress
  ON progress.food_id = source.source_food_id
ON CONFLICT (owner_id, food_id) DO UPDATE
SET
  final_preference = CASE
    WHEN food_progress.final_preference <> 0 AND EXCLUDED.final_preference = 0 THEN food_progress.final_preference
    WHEN food_progress.final_preference = 0 AND EXCLUDED.final_preference <> 0 THEN EXCLUDED.final_preference
    WHEN food_progress.updated_at >= EXCLUDED.updated_at THEN food_progress.final_preference
    ELSE EXCLUDED.final_preference
  END,
  note = CASE
    WHEN btrim(food_progress.note) <> '' AND btrim(EXCLUDED.note) = '' THEN food_progress.note
    WHEN btrim(food_progress.note) = '' AND btrim(EXCLUDED.note) <> '' THEN EXCLUDED.note
    WHEN food_progress.updated_at >= EXCLUDED.updated_at THEN food_progress.note
    ELSE EXCLUDED.note
  END,
  updated_at = GREATEST(food_progress.updated_at, EXCLUDED.updated_at),
  exposure_count = GREATEST(food_progress.exposure_count, EXCLUDED.exposure_count),
  first_tasted_on = CASE
    WHEN food_progress.first_tasted_on IS NULL THEN EXCLUDED.first_tasted_on
    WHEN EXCLUDED.first_tasted_on IS NULL THEN food_progress.first_tasted_on
    ELSE LEAST(food_progress.first_tasted_on, EXCLUDED.first_tasted_on)
  END;

WITH affected_foods AS (
  SELECT DISTINCT target_food_id AS food_id
  FROM food_merge_sources
),
tasting_rollup AS (
  SELECT
    tasting.owner_id,
    tasting.food_id,
    COUNT(*)::INTEGER AS exposure_count,
    MIN(tasting.tasted_on) AS first_tasted_on,
    MAX(tasting.updated_at) AS updated_at
  FROM food_tastings AS tasting
  WHERE tasting.food_id IN (SELECT food_id FROM affected_foods)
  GROUP BY tasting.owner_id, tasting.food_id
)
INSERT INTO food_progress (
  owner_id,
  food_id,
  final_preference,
  note,
  updated_at,
  exposure_count,
  first_tasted_on
)
SELECT
  rollup.owner_id,
  rollup.food_id,
  0,
  '',
  rollup.updated_at,
  rollup.exposure_count,
  rollup.first_tasted_on
FROM tasting_rollup AS rollup
ON CONFLICT (owner_id, food_id) DO UPDATE
SET
  updated_at = GREATEST(food_progress.updated_at, EXCLUDED.updated_at),
  exposure_count = EXCLUDED.exposure_count,
  first_tasted_on = EXCLUDED.first_tasted_on;

DELETE FROM food_tastings
WHERE food_id IN (
  SELECT source_food_id
  FROM food_merge_sources
);

DELETE FROM food_progress
WHERE food_id IN (
  SELECT source_food_id
  FROM food_merge_sources
);

DELETE FROM foods
WHERE id IN (
  SELECT source_food_id
  FROM food_merge_sources
);

UPDATE foods AS food
SET name = mapping.canonical_name
FROM categories AS c
INNER JOIN food_name_canonicalization AS mapping
  ON mapping.category_name = c.name
WHERE food.category_id = c.id
  AND food.owner_id IS NULL
  AND lower(food.name) = lower(mapping.alternate_name);

UPDATE foods
SET normalized_name = btrim(
  regexp_replace(
    translate(
      replace(
        replace(lower(name), 'œ', 'oe'),
        'æ',
        'ae'
      ),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'
    ),
    '\s+',
    ' ',
    'g'
  )
);

-- Down Migration

DO $$
BEGIN
  RAISE EXCEPTION 'Down migration blocked: merging canonical food duplicates is destructive.';
END
$$;
