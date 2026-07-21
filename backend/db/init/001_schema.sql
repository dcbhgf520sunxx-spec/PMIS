SET TIME ZONE 'Asia/Shanghai';
ALTER DATABASE pmis SET timezone TO 'Asia/Shanghai';
ALTER ROLE pms SET timezone TO 'Asia/Shanghai';

CREATE TABLE IF NOT EXISTS pms_user (
  id BIGSERIAL PRIMARY KEY,
  employee_no VARCHAR(50) NOT NULL UNIQUE,
  real_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  avatar_url VARCHAR(300),
  password VARCHAR(255) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1,
  first_login SMALLINT NOT NULL DEFAULT 1,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_role (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_user_role (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES pms_user(id),
  role_id BIGINT NOT NULL REFERENCES pms_role(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS pms_menu (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT NOT NULL DEFAULT 0,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  type SMALLINT NOT NULL DEFAULT 1,
  path VARCHAR(200),
  icon VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status SMALLINT NOT NULL DEFAULT 1,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_role_menu (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES pms_role(id),
  menu_id BIGINT NOT NULL REFERENCES pms_menu(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, menu_id)
);

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

CREATE TABLE IF NOT EXISTS pms_work_order (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  problem_type BIGINT NOT NULL,
  problem_desc TEXT NOT NULL,
  result_desc TEXT,
  follower_id BIGINT NOT NULL REFERENCES pms_user(id),
  urgency SMALLINT NOT NULL DEFAULT 1,
  status SMALLINT NOT NULL DEFAULT 0,
  is_overdue SMALLINT NOT NULL DEFAULT 0,
  expected_resolve_date TIMESTAMPTZ,
  resolve_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,
  suspend_date TIMESTAMPTZ,
  submitter_name VARCHAR(50) NOT NULL,
  submitter_dept VARCHAR(100) NOT NULL,
  submit_time TIMESTAMPTZ NOT NULL,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_pms_work_order_product
    FOREIGN KEY (product_id) REFERENCES pms_product(id) ON DELETE RESTRICT
);

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

CREATE TABLE IF NOT EXISTS pms_project_member (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS pms_project_contract (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pms_project(id) ON DELETE RESTRICT,
  contract_code VARCHAR(100) NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  supplier_id BIGINT NOT NULL,
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

CREATE TABLE IF NOT EXISTS pms_requirement (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  requirement_type SMALLINT NOT NULL CHECK (requirement_type IN (1,2,3,4)),
  product_id BIGINT NOT NULL REFERENCES pms_product(id) ON DELETE RESTRICT,
  project_id BIGINT REFERENCES pms_project(id) ON DELETE RESTRICT,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority IN (0,1,2)),
  status SMALLINT NOT NULL,
  is_overdue SMALLINT CHECK (is_overdue IN (0,1)),
  submitter_name VARCHAR(50) NOT NULL,
  submitter_dept VARCHAR(100),
  submit_date DATE NOT NULL,
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  pause_date DATE,
  completion_status TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_archive_type (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  code_prefix VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_archive (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  archive_type_id BIGINT NOT NULL REFERENCES pms_archive_type(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status SMALLINT NOT NULL DEFAULT 1,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_project_contract_supplier'
      AND conrelid = 'pms_project_contract'::regclass
  ) THEN
    ALTER TABLE pms_project_contract
      ADD CONSTRAINT fk_project_contract_supplier
      FOREIGN KEY (supplier_id) REFERENCES pms_archive(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_pms_work_order_problem_type'
      AND conrelid = 'pms_work_order'::regclass
  ) THEN
    ALTER TABLE pms_work_order
      ADD CONSTRAINT fk_pms_work_order_problem_type
      FOREIGN KEY (problem_type) REFERENCES pms_archive(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pms_task (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, description TEXT,
  parent_task_id BIGINT REFERENCES pms_task(id) ON DELETE RESTRICT,
  source_type SMALLINT NOT NULL CHECK (source_type IN (1,2)),
  project_id BIGINT REFERENCES pms_project(id) ON DELETE RESTRICT,
  requirement_id BIGINT REFERENCES pms_requirement(id) ON DELETE RESTRICT,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  task_type BIGINT NOT NULL REFERENCES pms_archive(id) ON DELETE RESTRICT,
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority IN (0,1,2)),
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3)),
  is_overdue SMALLINT NOT NULL DEFAULT 0 CHECK (is_overdue IN (0,1)),
  start_date DATE, expected_end_date DATE, actual_end_date DATE, suspend_date DATE,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((source_type=1 AND project_id IS NOT NULL AND requirement_id IS NULL) OR (source_type=2 AND requirement_id IS NOT NULL AND project_id IS NULL))
);

CREATE TABLE IF NOT EXISTS pms_bug (
  id BIGSERIAL PRIMARY KEY,
  source_type SMALLINT NOT NULL CHECK (source_type IN (1,2)),
  project_id BIGINT REFERENCES pms_project(id) ON DELETE RESTRICT,
  requirement_id BIGINT REFERENCES pms_requirement(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  bug_type_id BIGINT NOT NULL REFERENCES pms_archive(id) ON DELETE RESTRICT,
  severity SMALLINT NOT NULL CHECK (severity IN (1,2,3,4)),
  status SMALLINT NOT NULL DEFAULT 0 CHECK (status IN (0,1,2,3)),
  assignee_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  resolution_id BIGINT REFERENCES pms_archive(id) ON DELETE RESTRICT,
  resolved_date DATE,
  closed_date DATE,
  activation_reason TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((source_type=1 AND project_id IS NOT NULL AND requirement_id IS NULL) OR (source_type=2 AND requirement_id IS NOT NULL AND project_id IS NULL)),
  CONSTRAINT chk_bug_resolution_id_status CHECK (status IN (1,2,3) OR resolution_id IS NULL),
  CONSTRAINT chk_bug_resolved_date_status CHECK (status IN (1,2,3) OR resolved_date IS NULL),
  CHECK (status = 2 OR closed_date IS NULL),
  CHECK ((status <> 3 OR activation_reason IS NOT NULL) AND (activation_reason IS NULL OR (btrim(activation_reason) <> '' AND char_length(activation_reason) <= 100)))
);

CREATE TABLE IF NOT EXISTS pms_op_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES pms_user(id),
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  target_id BIGINT,
  target_name VARCHAR(200),
  operation_id UUID,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_access_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES pms_user(id),
  employee_no VARCHAR(50),
  account VARCHAR(100) NOT NULL DEFAULT '',
  real_name VARCHAR(50),
  event_type VARCHAR(30) NOT NULL,
  result VARCHAR(30) NOT NULL,
  fail_reason VARCHAR(100),
  session_id VARCHAR(100) UNIQUE,
  login_at TIMESTAMPTZ,
  logout_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  ip VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_user_preference (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES pms_user(id),
  default_route VARCHAR(200) NOT NULL DEFAULT '/home',
  default_page_size INTEGER NOT NULL DEFAULT 20,
  appearance_mode VARCHAR(20) NOT NULL DEFAULT 'light',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS pms_message (
  id BIGSERIAL PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES pms_user(id),
  type VARCHAR(30) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) <= 1000),
  link_path VARCHAR(200),
  read_at TIMESTAMPTZ,
  creator_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_status_deleted ON pms_user(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_role_deleted ON pms_role(is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_role_code_active ON pms_role(code) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_menu_path ON pms_menu(path);
CREATE INDEX IF NOT EXISTS idx_work_order_status ON pms_work_order(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_work_order_follower ON pms_work_order(follower_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_product_name_active ON pms_product(name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_product_owner_status ON pms_product(owner_id, status, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_name_active ON pms_project(name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_product_status ON pms_project(product_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_project_owner_status ON pms_project(owner_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_project_expected_end ON pms_project(expected_end_date, is_deleted);
CREATE INDEX IF NOT EXISTS idx_project_member_user ON pms_project_member(user_id, project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_contract_project_active ON pms_project_contract(project_id) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_contract_code_active ON pms_project_contract(contract_code) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_contract_supplier_active ON pms_project_contract(supplier_id) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_project_payment_stage_name_active ON pms_project_payment_stage(contract_id, stage_name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_payment_stage_contract ON pms_project_payment_stage(contract_id, sort_order, id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_project_payment_record_stage ON pms_project_payment_record(stage_id, payment_month, id) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_requirement_title_active ON pms_requirement(title) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_requirement_product_status ON pms_requirement(product_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_project ON pms_requirement(project_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_owner_status ON pms_requirement(owner_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_type_status ON pms_requirement(requirement_type, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_expected_end ON pms_requirement(expected_end_date, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_task_name_active ON pms_task(name) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_task_project ON pms_task(project_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_requirement ON pms_task(requirement_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_parent ON pms_task(parent_task_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_owner_status ON pms_task(owner_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_type_status ON pms_task(task_type, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_expected_end ON pms_task(expected_end_date, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS uk_bug_title_active ON pms_bug(title) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_bug_project ON pms_bug(project_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_requirement ON pms_bug(requirement_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_assignee_status ON pms_bug(assignee_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_type_status ON pms_bug(bug_type_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_severity_status ON pms_bug(severity, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_created_at ON pms_bug(created_at DESC, id DESC) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uk_work_order_problem_desc_active ON pms_work_order(md5(problem_desc)) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_archive_type ON pms_archive(archive_type_id, is_deleted);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_code_active ON pms_archive_type(code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_prefix_active ON pms_archive_type(code_prefix) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_op_log_target ON pms_op_log(module, target_id);
CREATE INDEX IF NOT EXISTS idx_op_log_operation ON pms_op_log(operation_id);
CREATE INDEX IF NOT EXISTS idx_op_log_module_created_at ON pms_op_log(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON pms_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_access_log_session ON pms_access_log(session_id);
CREATE INDEX IF NOT EXISTS idx_access_log_employee_no ON pms_access_log(employee_no);
CREATE INDEX IF NOT EXISTS idx_user_preference_user ON pms_user_preference(user_id);
CREATE INDEX IF NOT EXISTS idx_message_recipient_read ON pms_message(recipient_user_id, read_at, is_deleted);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON pms_message(created_at);

INSERT INTO pms_user (id, employee_no, real_name, phone, password, status, first_login)
VALUES (1, 'admin', '管理员', '13800000000', '$2b$10$sJ8gCvuCgJQbcihvZEIWheUQEq1oIyVVh3EZa8fSlpOy80ihQ5UPi', 1, 1)
ON CONFLICT (employee_no) DO NOTHING;

INSERT INTO pms_role (id, code, name, description, creator_id, updater_id)
VALUES (1, 'admin', '管理员', '系统管理员，拥有所有权限', 1, 1)
ON CONFLICT (code) WHERE is_deleted = 0 DO NOTHING;

INSERT INTO pms_user_role (user_id, role_id)
VALUES (1, 1)
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO pms_menu (id, parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES
  (8, 0, '首页', 'home', 2, '/home', 'HomeOutlined', 5, 1, 1),
  (1, 0, '运维工单', 'work_order', 2, '/work-orders', 'ToolOutlined', 11, 1, 1),
  (2, 0, '基础设置', 'base_settings', 1, NULL, 'SettingOutlined', 20, 1, 1),
  (3, 2, '基础档案', 'archive', 2, '/archive', NULL, 21, 1, 1),
  (4, 0, '用户权限', 'user_auth', 1, NULL, 'UserOutlined', 30, 1, 1),
  (5, 4, '角色管理', 'role', 2, '/roles', NULL, 32, 1, 1),
  (6, 4, '用户管理', 'user', 2, '/users', NULL, 31, 1, 1),
  (7, 2, '访问日志', 'access_log', 2, '/access-logs', NULL, 22, 1, 1),
  (9, 0, '组件工作台', 'design_system', 1, NULL, 'ExperimentOutlined', 40, 1, 1),
  (10, 9, '总览', 'design_system_overview', 2, '/system/design-system?category=overview', NULL, 41, 1, 1),
  (11, 9, '页面样板', 'design_system_samples', 2, '/samples/work-order', NULL, 42, 1, 1),
  (12, 9, '设计基础', 'design_system_foundation', 2, '/system/design-system?category=foundation', NULL, 43, 1, 1),
  (13, 9, '页面模式', 'design_system_layout', 2, '/system/design-system?category=layout', NULL, 44, 1, 1),
  (14, 9, '基础组件', 'design_system_base', 2, '/system/design-system?category=base', NULL, 45, 1, 1),
  (15, 9, '输入组件', 'design_system_input', 2, '/system/design-system?category=input', NULL, 46, 1, 1),
  (16, 9, '反馈组件', 'design_system_feedback', 2, '/system/design-system?category=feedback', NULL, 47, 1, 1),
  (17, 9, '数据展示', 'design_system_display', 2, '/system/design-system?category=display', NULL, 48, 1, 1),
  (18, 0, '产品管理', 'product', 2, '/products', 'AppstoreOutlined', 6, 1, 1),
  (19, 0, '项目管理', 'project', 2, '/projects', 'ProjectOutlined', 7, 1, 1),
  (20, 0, '需求管理', 'requirement', 2, '/requirements', 'FileTextOutlined', 8, 1, 1),
  (21, 0, '任务管理', 'task', 2, '/tasks', 'CheckSquareOutlined', 9, 1, 1),
  (22, 0, 'BUG管理', 'bug', 2, '/bugs', 'BugOutlined', 10, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT 1, id FROM pms_menu
ON CONFLICT (role_id, menu_id) DO NOTHING;

INSERT INTO pms_archive_type (id, code, code_prefix, name, creator_id, updater_id)
VALUES
  (1, '001', 'SYS', '系统', 1, 1),
  (2, '002', 'PT', '问题类型', 1, 1),
  (3, 'task_type', 'TT', '任务类型', 1, 1),
  (4, 'bug_type', 'BT', 'Bug类型', 1, 1),
  (5, 'bug_resolution', 'BR', 'Bug解决方案', 1, 1),
  (6, 'supplier', 'SUP', '供应商', 1, 1)
ON CONFLICT (code) WHERE is_deleted = 0 DO UPDATE SET
  name = EXCLUDED.name,
  code_prefix = EXCLUDED.code_prefix,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_archive (code, name, archive_type_id, sort_order, creator_id, updater_id)
VALUES
  ('SYS001', '后台管理系统', 1, 1, 1, 1),
  ('PT001', '日常操作', 2, 1, 1, 1),
  ('PT002', '系统优化', 2, 2, 1, 1),
  ('PT003', '故障报障', 2, 3, 1, 1),
  ('PT004', '后台维护', 2, 4, 1, 1),
  ('PT005', '其他', 2, 5, 1, 1)
  ,('TT001', '需求', 3, 1, 1, 1)
  ,('TT002', '设计', 3, 2, 1, 1)
  ,('TT003', '开发', 3, 3, 1, 1)
  ,('TT004', '测试', 3, 4, 1, 1)
  ,('TT005', '研究', 3, 5, 1, 1)
  ,('TT006', '讨论', 3, 6, 1, 1)
  ,('TT007', '事务', 3, 7, 1, 1)
  ,('TT008', '其他', 3, 8, 1, 1)
  ,('BT001', '功能', 4, 1, 1, 1)
  ,('BT002', '界面', 4, 2, 1, 1)
  ,('BT003', '性能', 4, 3, 1, 1)
  ,('BT004', '兼容', 4, 4, 1, 1)
  ,('BT005', '安全', 4, 5, 1, 1)
  ,('BT006', '其他', 4, 6, 1, 1)
  ,('BR001', '已修复', 5, 1, 1, 1)
  ,('BR002', '设计如此', 5, 2, 1, 1)
  ,('BR003', '无法重现', 5, 3, 1, 1)
  ,('BR004', '延期处理', 5, 4, 1, 1)
  ,('BR005', '外部原因', 5, 5, 1, 1)
  ,('BR006', '重复', 5, 6, 1, 1)
ON CONFLICT (code) DO NOTHING;

SELECT setval('pms_user_id_seq', COALESCE((SELECT MAX(id) FROM pms_user), 1), true);
SELECT setval('pms_role_id_seq', COALESCE((SELECT MAX(id) FROM pms_role), 1), true);
SELECT setval('pms_menu_id_seq', COALESCE((SELECT MAX(id) FROM pms_menu), 1), true);
SELECT setval('pms_archive_type_id_seq', COALESCE((SELECT MAX(id) FROM pms_archive_type), 1), true);
SELECT setval('pms_access_log_id_seq', COALESCE((SELECT MAX(id) FROM pms_access_log), 1), true);
SELECT setval('pms_user_preference_id_seq', COALESCE((SELECT MAX(id) FROM pms_user_preference), 1), true);
