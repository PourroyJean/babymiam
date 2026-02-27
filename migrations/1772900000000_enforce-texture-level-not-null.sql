-- Up Migration

UPDATE food_tastings
SET texture_level = 1
WHERE texture_level IS NULL;

ALTER TABLE food_tastings
  ALTER COLUMN texture_level SET DEFAULT 1;

ALTER TABLE food_tastings
  ALTER COLUMN texture_level SET NOT NULL;

-- Down Migration

ALTER TABLE food_tastings
  ALTER COLUMN texture_level DROP NOT NULL;

ALTER TABLE food_tastings
  ALTER COLUMN texture_level DROP DEFAULT;
