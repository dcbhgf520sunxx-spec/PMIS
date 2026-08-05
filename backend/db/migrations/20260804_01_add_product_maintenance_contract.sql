CREATE TABLE IF NOT EXISTS pms_product_maintenance_contract (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES pms_product(id) ON DELETE RESTRICT,
  previous_contract_id BIGINT REFERENCES pms_product_maintenance_contract(id) ON DELETE RESTRICT,
  contract_code VARCHAR(100) NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  supplier_id BIGINT NOT NULL REFERENCES pms_archive(id) ON DELETE RESTRICT,
  signed_date DATE NOT NULL,
  service_start_date DATE NOT NULL,
  service_end_date DATE NOT NULL,
  contract_amount NUMERIC(18,2) NOT NULL CHECK (contract_amount > 0),
  termination_date DATE,
  termination_reason VARCHAR(500),
  remark TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (service_end_date >= service_start_date),
  CHECK ((termination_date IS NULL AND termination_reason IS NULL) OR
    (termination_date IS NOT NULL AND termination_reason IS NOT NULL AND btrim(termination_reason) <> '' AND termination_date BETWEEN service_start_date AND service_end_date))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_maintenance_contract_code_active
  ON pms_product_maintenance_contract(contract_code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_product_maintenance_contract_root_active
  ON pms_product_maintenance_contract(product_id) WHERE previous_contract_id IS NULL AND is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_product_maintenance_contract_previous_active
  ON pms_product_maintenance_contract(previous_contract_id) WHERE previous_contract_id IS NOT NULL AND is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_product_maintenance_contract_product_active
  ON pms_product_maintenance_contract(product_id, service_start_date DESC) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_product_maintenance_contract_supplier_active
  ON pms_product_maintenance_contract(supplier_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_product_maintenance_contract_expiry_active
  ON pms_product_maintenance_contract(service_end_date) WHERE is_deleted = 0 AND termination_date IS NULL;

CREATE TABLE IF NOT EXISTS pms_product_maintenance_contract_attachment (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pms_product_maintenance_contract(id) ON DELETE RESTRICT,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  oss_response JSONB,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_maintenance_contract_attachment_storage_name
  ON pms_product_maintenance_contract_attachment(storage_name);
CREATE INDEX IF NOT EXISTS idx_product_maintenance_contract_attachment_contract_active
  ON pms_product_maintenance_contract_attachment(contract_id, sort_order) WHERE is_deleted = 0;

CREATE TABLE IF NOT EXISTS pms_scheduled_task_execution (
  id BIGSERIAL PRIMARY KEY,
  task_code VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT NOT NULL,
  execution_key VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  error_message VARCHAR(500),
  result_data JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_code, target_type, target_id, execution_key)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_task_execution_status
  ON pms_scheduled_task_execution(task_code, status, updated_at);
