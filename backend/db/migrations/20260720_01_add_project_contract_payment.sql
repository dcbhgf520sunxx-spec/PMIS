CREATE TABLE IF NOT EXISTS pms_project_contract (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE RESTRICT,
  contract_code VARCHAR(100) NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  signed_date DATE NOT NULL,
  contract_amount NUMERIC(18,2) NOT NULL CHECK (contract_amount > 0),
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_project_payment_stage (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pms_project_contract(id) ON DELETE RESTRICT,
  stage_name VARCHAR(100) NOT NULL,
  planned_amount NUMERIC(18,2) NOT NULL CHECK (planned_amount > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_project_payment_record (
  id BIGSERIAL PRIMARY KEY,
  stage_id BIGINT NOT NULL REFERENCES pms_project_payment_stage(id) ON DELETE RESTRICT,
  payment_amount NUMERIC(18,2) NOT NULL CHECK (payment_amount > 0),
  payment_month DATE NOT NULL,
  handler_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  remark TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (payment_month = DATE_TRUNC('month', payment_month)::DATE)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_project_contract_project_active ON pms_project_contract(project_id) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_contract_code_active ON pms_project_contract(contract_code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_payment_stage_name_active ON pms_project_payment_stage(contract_id, stage_name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_payment_stage_contract ON pms_project_payment_stage(contract_id, sort_order, id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_payment_record_stage ON pms_project_payment_record(stage_id, payment_month, id) WHERE is_deleted = 0;
