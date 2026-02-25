-- Up Migration

ALTER TABLE foods
  ADD COLUMN owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE foods
  DROP CONSTRAINT IF EXISTS foods_category_id_name_key;

CREATE UNIQUE INDEX foods_unique_global_category_name_idx
  ON foods (category_id, lower(name))
  WHERE owner_id IS NULL;

CREATE UNIQUE INDEX foods_unique_owner_category_name_idx
  ON foods (category_id, owner_id, lower(name))
  WHERE owner_id IS NOT NULL;

CREATE INDEX idx_foods_category_owner_sort_order
  ON foods (category_id, owner_id, sort_order, id);

-- Down Migration

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM foods
    WHERE owner_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Down migration blocked: owner-scoped foods exist. Delete custom foods before rollback.';
  END IF;
END
$$;

DROP INDEX IF EXISTS idx_foods_category_owner_sort_order;
DROP INDEX IF EXISTS foods_unique_owner_category_name_idx;
DROP INDEX IF EXISTS foods_unique_global_category_name_idx;

ALTER TABLE foods
  DROP COLUMN IF EXISTS owner_id;

ALTER TABLE foods
  ADD CONSTRAINT foods_category_id_name_key UNIQUE (category_id, name);
