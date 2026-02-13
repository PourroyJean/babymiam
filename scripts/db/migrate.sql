CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  CREATE TYPE event_visibility AS ENUM ('private', 'public');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_foods_category_sort_order
  ON foods(category_id, sort_order);

CREATE TABLE IF NOT EXISTS food_progress (
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  exposure_count INTEGER NOT NULL DEFAULT 0 CHECK (exposure_count BETWEEN 0 AND 3),
  preference SMALLINT NOT NULL DEFAULT 0 CHECK (preference BETWEEN -1 AND 1),
  first_tasted_on DATE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(owner_id, food_id)
);

ALTER TABLE food_progress
  ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS exposure_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preference SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_tasted_on DATE,
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  pkey_name TEXT;
  pkey_def TEXT;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
  INTO pkey_name, pkey_def
  FROM pg_constraint
  WHERE conrelid = 'food_progress'::regclass
    AND contype = 'p';

  IF pkey_name IS NOT NULL
    AND pkey_def NOT ILIKE '%(owner_id, food_id)%'
    AND NOT EXISTS (SELECT 1 FROM food_progress WHERE owner_id IS NULL)
  THEN
    EXECUTE format('ALTER TABLE food_progress DROP CONSTRAINT %I', pkey_name);
    ALTER TABLE food_progress ADD PRIMARY KEY(owner_id, food_id);
  END IF;

  IF pkey_name IS NULL
    AND NOT EXISTS (SELECT 1 FROM food_progress WHERE owner_id IS NULL)
  THEN
    ALTER TABLE food_progress ADD PRIMARY KEY(owner_id, food_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'food_progress'
      AND column_name = 'owner_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM food_progress WHERE owner_id IS NULL)
  THEN
    ALTER TABLE food_progress ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_food_progress_updated_at
  ON food_progress(updated_at);

CREATE INDEX IF NOT EXISTS idx_food_progress_owner_updated_at
  ON food_progress(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS child_profiles (
  owner_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (char_length(btrim(first_name)) > 0),
  birth_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  pkey_name TEXT;
  pkey_def TEXT;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
  INTO pkey_name, pkey_def
  FROM pg_constraint
  WHERE conrelid = 'child_profiles'::regclass
    AND contype = 'p';

  IF pkey_name IS NOT NULL
    AND pkey_def NOT ILIKE '%(owner_id)%'
  THEN
    EXECUTE format('ALTER TABLE child_profiles DROP CONSTRAINT %I', pkey_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'child_profiles'::regclass
      AND contype = 'p'
  ) AND NOT EXISTS (SELECT 1 FROM child_profiles WHERE owner_id IS NULL)
  THEN
    ALTER TABLE child_profiles ADD PRIMARY KEY(owner_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'child_profiles'
      AND column_name = 'owner_key'
  ) THEN
    ALTER TABLE child_profiles ALTER COLUMN owner_key DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'child_profiles'
      AND column_name = 'owner_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM child_profiles WHERE owner_id IS NULL)
  THEN
    ALTER TABLE child_profiles ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_child_profiles_owner_id_unique
  ON child_profiles(owner_id);

CREATE TABLE IF NOT EXISTS growth_events (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  channel TEXT,
  visibility event_visibility NOT NULL DEFAULT 'private',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_events
  ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_name TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS visibility event_visibility,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'growth_events'
      AND column_name = 'owner_key'
  ) THEN
    ALTER TABLE growth_events ALTER COLUMN owner_key DROP NOT NULL;
  END IF;
END $$;

UPDATE growth_events
SET visibility = 'private'
WHERE visibility IS NULL;

ALTER TABLE growth_events
  ALTER COLUMN visibility SET DEFAULT 'private';

ALTER TABLE growth_events
  ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'growth_events'
      AND column_name = 'owner_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM growth_events WHERE owner_id IS NULL)
  THEN
    ALTER TABLE growth_events ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_growth_events_event_created_at
  ON growth_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_owner_created_at
  ON growth_events(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_visibility_created_at
  ON growth_events(visibility, created_at DESC);

CREATE TABLE IF NOT EXISTS share_snapshots (
  share_id TEXT PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility event_visibility NOT NULL DEFAULT 'public',
  first_name TEXT,
  introduced_count INTEGER NOT NULL DEFAULT 0,
  total_foods INTEGER NOT NULL DEFAULT 0,
  liked_count INTEGER NOT NULL DEFAULT 0,
  milestone INTEGER,
  recent_foods JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_snapshots_owner_created_at
  ON share_snapshots(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_snapshots_visibility_created_at
  ON share_snapshots(visibility, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_created_at
  ON password_reset_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry
  ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email_norm TEXT,
  ip INET,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_created_at
  ON auth_login_attempts(email_norm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_created_at
  ON auth_login_attempts(ip, created_at DESC);
