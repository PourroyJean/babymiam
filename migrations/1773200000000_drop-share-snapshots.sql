-- Up Migration

DROP TABLE IF EXISTS share_snapshots;

-- Down Migration

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
