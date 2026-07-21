CREATE TABLE IF NOT EXISTS pms_project_contract_attachment (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pms_project_contract(id) ON DELETE RESTRICT,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_project_contract_attachment_storage_name
  ON pms_project_contract_attachment(storage_name);

CREATE INDEX IF NOT EXISTS idx_project_contract_attachment_contract_active
  ON pms_project_contract_attachment(contract_id, sort_order, id)
  WHERE is_deleted = 0;
