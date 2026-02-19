-- Up Migration

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE event_visibility AS ENUM ('private', 'public');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE foods (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(category_id, name)
);

CREATE INDEX idx_foods_category_sort_order ON foods(category_id, sort_order);

CREATE TABLE food_progress (
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  final_preference SMALLINT NOT NULL DEFAULT 0 CHECK (final_preference BETWEEN -1 AND 1),
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exposure_count INTEGER NOT NULL DEFAULT 0,
  first_tasted_on DATE,
  PRIMARY KEY(owner_id, food_id)
);

CREATE INDEX idx_food_progress_owner_updated_at ON food_progress(owner_id, updated_at DESC);

CREATE TABLE food_tastings (
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  liked BOOLEAN NOT NULL,
  tasted_on DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  texture_level SMALLINT CHECK (texture_level BETWEEN 1 AND 4),
  reaction_type SMALLINT CHECK (reaction_type BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(owner_id, food_id, slot)
);

CREATE INDEX idx_food_tastings_owner_updated_at ON food_tastings(owner_id, updated_at DESC);
CREATE INDEX idx_food_tastings_owner_tasted_on ON food_tastings(owner_id, tasted_on DESC, updated_at DESC);

CREATE TABLE child_profiles (
  owner_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (char_length(btrim(first_name)) > 0),
  birth_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE growth_events (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  channel TEXT,
  visibility event_visibility NOT NULL DEFAULT 'private',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_growth_events_event_created_at ON growth_events(event_name, created_at DESC);
CREATE INDEX idx_growth_events_owner_created_at ON growth_events(owner_id, created_at DESC);
CREATE INDEX idx_growth_events_visibility_created_at ON growth_events(visibility, created_at DESC);

CREATE TABLE share_snapshots (
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

CREATE INDEX idx_share_snapshots_owner_created_at ON share_snapshots(owner_id, created_at DESC);
CREATE INDEX idx_share_snapshots_visibility_created_at ON share_snapshots(visibility, created_at DESC);

CREATE TABLE password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_created_at ON password_reset_tokens(user_id, created_at DESC);
CREATE INDEX idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at);

CREATE TABLE auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email_norm TEXT,
  ip INET,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_login_attempts_email_created_at ON auth_login_attempts(email_norm, created_at DESC);
CREATE INDEX idx_auth_login_attempts_ip_created_at ON auth_login_attempts(ip, created_at DESC);

CREATE TABLE auth_signup_attempts (
  id BIGSERIAL PRIMARY KEY,
  email_norm TEXT,
  ip INET,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_signup_attempts_email_created_at ON auth_signup_attempts(email_norm, created_at DESC);
CREATE INDEX idx_auth_signup_attempts_ip_created_at ON auth_signup_attempts(ip, created_at DESC);

CREATE TABLE email_verification_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_user_created_at ON email_verification_tokens(user_id, created_at DESC);
CREATE INDEX idx_email_verification_tokens_expiry ON email_verification_tokens(expires_at);

-- Down Migration

DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS auth_signup_attempts;
DROP TABLE IF EXISTS auth_login_attempts;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS share_snapshots;
DROP TABLE IF EXISTS growth_events;
DROP TABLE IF EXISTS child_profiles;
DROP TABLE IF EXISTS food_tastings;
DROP TABLE IF EXISTS food_progress;
DROP TABLE IF EXISTS foods;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS event_visibility;
DROP EXTENSION IF EXISTS citext;
