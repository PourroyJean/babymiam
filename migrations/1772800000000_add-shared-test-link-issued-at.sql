-- Up Migration

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS shared_test_link_issued_at TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN shared_test_link_issued_at SET DEFAULT NOW();

UPDATE users
SET shared_test_link_issued_at = NOW()
WHERE shared_test_link_issued_at IS NULL;

-- Down Migration

ALTER TABLE users
  DROP COLUMN IF EXISTS shared_test_link_issued_at;
