-- Up Migration

ALTER TABLE food_progress
  ADD COLUMN IF NOT EXISTS exposure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_tasted_on DATE;

-- Down Migration

ALTER TABLE food_progress
  DROP COLUMN IF EXISTS first_tasted_on,
  DROP COLUMN IF EXISTS exposure_count;
