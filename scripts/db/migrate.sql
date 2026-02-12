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
  food_id INTEGER PRIMARY KEY REFERENCES foods(id) ON DELETE CASCADE,
  exposure_count INTEGER NOT NULL DEFAULT 0 CHECK (exposure_count BETWEEN 0 AND 3),
  preference SMALLINT NOT NULL DEFAULT 0 CHECK (preference BETWEEN -1 AND 1),
  first_tasted_on DATE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_progress_updated_at
  ON food_progress(updated_at);

CREATE TABLE IF NOT EXISTS child_profiles (
  owner_key TEXT PRIMARY KEY,
  first_name TEXT NOT NULL CHECK (char_length(btrim(first_name)) > 0),
  birth_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
