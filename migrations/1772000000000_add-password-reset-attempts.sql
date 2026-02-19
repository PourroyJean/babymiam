-- Up Migration

CREATE TABLE auth_password_reset_attempts (
  id BIGSERIAL PRIMARY KEY,
  email_norm TEXT,
  ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_password_reset_attempts_email_created_at
  ON auth_password_reset_attempts(email_norm, created_at DESC);

CREATE INDEX idx_auth_password_reset_attempts_ip_created_at
  ON auth_password_reset_attempts(ip, created_at DESC);

CREATE INDEX idx_auth_password_reset_attempts_created_at
  ON auth_password_reset_attempts(created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS auth_password_reset_attempts;
