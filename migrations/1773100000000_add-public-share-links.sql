-- Up Migration

CREATE TABLE public_share_links (
  owner_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_public_share_links_expires_at ON public_share_links(expires_at);

-- Down Migration

DROP TABLE IF EXISTS public_share_links;
