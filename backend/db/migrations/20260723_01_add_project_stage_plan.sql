CREATE TABLE IF NOT EXISTS pms_project_plan_stage (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_project_plan_item (
  id BIGSERIAL PRIMARY KEY,
  stage_id BIGINT NOT NULL REFERENCES pms_project_plan_stage(id) ON DELETE RESTRICT,
  name VARCHAR(200) NOT NULL,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3,4)),
  previous_status SMALLINT CHECK (previous_status IS NULL OR previous_status IN (0,1,3)),
  original_due_date DATE NOT NULL,
  current_due_date DATE NOT NULL,
  actual_end_date DATE,
  requires_delivery_file SMALLINT NOT NULL DEFAULT 0 CHECK (requires_delivery_file IN (0,1)),
  delivery_requirement TEXT,
  remark TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requires_delivery_file = 0 OR NULLIF(BTRIM(delivery_requirement), '') IS NOT NULL),
  CHECK (status = 2 OR actual_end_date IS NULL)
);

CREATE TABLE IF NOT EXISTS pms_project_plan_item_collaborator (
  plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_item_id, user_id)
);

CREATE TABLE IF NOT EXISTS pms_project_plan_adjustment (
  id BIGSERIAL PRIMARY KEY,
  plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT,
  old_due_date DATE NOT NULL,
  new_due_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason), '') IS NOT NULL),
  operator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_project_plan_delivery_file (
  id BIGSERIAL PRIMARY KEY,
  plan_item_id BIGINT NOT NULL REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT,
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  version_no INTEGER NOT NULL DEFAULT 1 CHECK (version_no > 0),
  replaces_file_id BIGINT REFERENCES pms_project_plan_delivery_file(id) ON DELETE RESTRICT,
  is_current SMALLINT NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  is_void SMALLINT NOT NULL DEFAULT 0 CHECK (is_void IN (0,1)),
  change_note TEXT,
  uploader_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pms_task ADD COLUMN IF NOT EXISTS plan_item_id BIGINT REFERENCES pms_project_plan_item(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_project_plan_stage_name_active ON pms_project_plan_stage(project_id, name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_plan_stage_project_active ON pms_project_plan_stage(project_id, sort_order, id) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_plan_item_name_active ON pms_project_plan_item(stage_id, name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_plan_item_stage_active ON pms_project_plan_item(stage_id, sort_order, id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_plan_item_owner_status ON pms_project_plan_item(owner_id, status, current_due_date) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_plan_adjustment_item ON pms_project_plan_adjustment(plan_item_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_plan_delivery_storage_key ON pms_project_plan_delivery_file(storage_key);
CREATE INDEX IF NOT EXISTS idx_project_plan_delivery_item_current ON pms_project_plan_delivery_file(plan_item_id, created_at DESC) WHERE is_current = 1 AND is_void = 0;
CREATE INDEX IF NOT EXISTS idx_task_plan_item_active ON pms_task(plan_item_id) WHERE is_deleted = 0;
