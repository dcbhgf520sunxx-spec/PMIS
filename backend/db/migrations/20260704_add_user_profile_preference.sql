ALTER TABLE pms_user
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(300);

CREATE TABLE IF NOT EXISTS pms_user_preference (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES pms_user(id),
  default_route VARCHAR(200) NOT NULL DEFAULT '/work-orders',
  default_page_size INTEGER NOT NULL DEFAULT 20,
  appearance_mode VARCHAR(20) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preference_user ON pms_user_preference(user_id);
