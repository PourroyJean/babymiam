-- Up Migration

ALTER TABLE food_tastings
  ALTER COLUMN liked DROP NOT NULL;

-- Down Migration

UPDATE food_tastings
SET liked = false
WHERE liked IS NULL;

ALTER TABLE food_tastings
  ALTER COLUMN liked SET NOT NULL;
