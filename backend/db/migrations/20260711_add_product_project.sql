CREATE TABLE IF NOT EXISTS pms_product (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_name_active ON pms_product(name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_product_owner_status ON pms_product(owner_id, status, is_deleted);

CREATE TABLE IF NOT EXISTS pms_project (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  product_id BIGINT NOT NULL REFERENCES pms_product(id) ON DELETE RESTRICT,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2, 3)),
  is_overdue SMALLINT NOT NULL DEFAULT 0 CHECK (is_overdue IN (0, 1)),
  start_date DATE,
  expected_end_date DATE NOT NULL,
  actual_end_date DATE,
  suspend_date DATE,
  progress_text TEXT,
  risk_text TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_project_name_active ON pms_project(name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_product_status ON pms_project(product_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_project_owner_status ON pms_project(owner_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_project_expected_end ON pms_project(expected_end_date, is_deleted);

CREATE TABLE IF NOT EXISTS pms_project_member (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_member_user ON pms_project_member(user_id, project_id);

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, status, creator_id, updater_id)
VALUES
  (0, '产品管理', 'product', 2, '/products', 'AppstoreOutlined', 10, 1, 1, 1),
  (0, '项目管理', 'project', 2, '/projects', 'ProjectOutlined', 20, 1, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT 1, id FROM pms_menu WHERE code IN ('product', 'project')
ON CONFLICT (role_id, menu_id) DO NOTHING;
