CREATE TABLE IF NOT EXISTS pms_business_attachment (
  id BIGSERIAL PRIMARY KEY,
  business_type VARCHAR(30) NOT NULL CHECK (business_type IN ('requirement','project','task','bug','work_order')),
  business_id BIGINT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  storage_key VARCHAR(255) NOT NULL,
  oss_response JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_attachment_active
  ON pms_business_attachment(business_type,business_id,sort_order,id)
  WHERE is_deleted=0;

CREATE UNIQUE INDEX IF NOT EXISTS uk_business_attachment_storage_key
  ON pms_business_attachment(storage_key);
