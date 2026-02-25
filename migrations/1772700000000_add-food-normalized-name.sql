-- Up Migration

ALTER TABLE foods
  ADD COLUMN normalized_name TEXT;

UPDATE foods
SET normalized_name = btrim(
  regexp_replace(
    translate(
      lower(name),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'
    ),
    '\s+',
    ' ',
    'g'
  )
);

ALTER TABLE foods
  ALTER COLUMN normalized_name SET NOT NULL;

DROP INDEX IF EXISTS foods_unique_global_category_name_idx;
DROP INDEX IF EXISTS foods_unique_owner_category_name_idx;

CREATE UNIQUE INDEX foods_unique_global_category_normalized_name_idx
  ON foods (category_id, normalized_name)
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX foods_unique_owner_category_normalized_name_idx
  ON foods (category_id, owner_id, normalized_name)
  WHERE owner_id IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS foods_unique_owner_category_normalized_name_idx;
DROP INDEX IF EXISTS foods_unique_global_category_normalized_name_idx;

CREATE UNIQUE INDEX foods_unique_global_category_name_idx
  ON foods (category_id, lower(name))
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX foods_unique_owner_category_name_idx
  ON foods (category_id, owner_id, lower(name))
  WHERE owner_id IS NOT NULL;

ALTER TABLE foods
  DROP COLUMN IF EXISTS normalized_name;
