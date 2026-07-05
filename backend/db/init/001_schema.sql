SET TIME ZONE 'Asia/Shanghai';
ALTER DATABASE project_template SET timezone TO 'Asia/Shanghai';
ALTER ROLE pms SET timezone TO 'Asia/Shanghai';

CREATE TABLE IF NOT EXISTS pms_user (
  id BIGSERIAL PRIMARY KEY,
  employee_no VARCHAR(50) NOT NULL UNIQUE,
  real_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) UNIQUE,
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
  code VARCHAR(50) NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS pms_work_order (
  id BIGSERIAL PRIMARY KEY,
  system_id BIGINT,
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
  submitter_name VARCHAR(50) NOT NULL,
  submitter_dept VARCHAR(100) NOT NULL,
  submit_time TIMESTAMPTZ NOT NULL,
  creator_id BIGINT,
  updater_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_archive_type (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  code_prefix VARCHAR(20) NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS pms_op_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES pms_user(id),
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  target_id BIGINT,
  target_name VARCHAR(200),
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
  appearance_mode VARCHAR(20) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS pms_message (
  id BIGSERIAL PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES pms_user(id),
  type VARCHAR(30) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  link_path VARCHAR(200),
  read_at TIMESTAMPTZ,
  creator_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_status_deleted ON pms_user(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_role_deleted ON pms_role(is_deleted);
CREATE INDEX IF NOT EXISTS idx_menu_path ON pms_menu(path);
CREATE INDEX IF NOT EXISTS idx_work_order_status ON pms_work_order(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_work_order_follower ON pms_work_order(follower_id);
CREATE INDEX IF NOT EXISTS idx_archive_type ON pms_archive(archive_type_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_op_log_target ON pms_op_log(module, target_id);
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON pms_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_access_log_session ON pms_access_log(session_id);
CREATE INDEX IF NOT EXISTS idx_access_log_employee_no ON pms_access_log(employee_no);
CREATE INDEX IF NOT EXISTS idx_user_preference_user ON pms_user_preference(user_id);
CREATE INDEX IF NOT EXISTS idx_message_recipient_read ON pms_message(recipient_user_id, read_at, is_deleted);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON pms_message(created_at);

INSERT INTO pms_user (id, employee_no, real_name, phone, password, status, first_login)
VALUES (1, 'admin', '管理员', '13800000000', '$2b$10$sJ8gCvuCgJQbcihvZEIWheUQEq1oIyVVh3EZa8fSlpOy80ihQ5UPi', 1, 0)
ON CONFLICT (employee_no) DO NOTHING;

INSERT INTO pms_role (id, code, name, description, creator_id, updater_id)
VALUES (1, 'admin', '管理员', '系统管理员，拥有所有权限', 1, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO pms_user_role (user_id, role_id)
VALUES (1, 1)
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO pms_menu (id, parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES
  (8, 0, '首页', 'home', 2, '/home', 'HomeOutlined', 5, 1, 1),
  (1, 0, '运维工单', 'work_order', 2, '/work-orders', 'ToolOutlined', 10, 1, 1),
  (2, 0, '基础设置', 'base_settings', 1, NULL, 'SettingOutlined', 30, 1, 1),
  (3, 2, '基础档案', 'archive', 2, '/archive', NULL, 31, 1, 1),
  (4, 0, '用户权限', 'user_auth', 1, NULL, 'UserOutlined', 20, 1, 1),
  (5, 4, '角色管理', 'role', 2, '/roles', NULL, 22, 1, 1),
  (6, 4, '用户管理', 'user', 2, '/users', NULL, 21, 1, 1),
  (7, 2, '访问日志', 'access_log', 2, '/access-logs', NULL, 32, 1, 1)
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

INSERT INTO pms_message (recipient_user_id, type, title, description, link_path, creator_id, created_at)
SELECT 1, 'notification', '工单明细导出完成', '导出文件已生成，可前往相关页面查看结果。', '/work-orders', 1, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '工单明细导出完成' AND is_deleted = 0
);

INSERT INTO pms_message (recipient_user_id, type, title, description, link_path, creator_id, created_at)
SELECT 1, 'notification', '基础档案同步完成', '本次同步成功更新 12 条档案记录。', '/archive', 1, NOW() - INTERVAL '12 minutes'
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '基础档案同步完成' AND is_deleted = 0
);

INSERT INTO pms_message (recipient_user_id, type, title, description, creator_id, read_at, created_at)
SELECT 1, 'system', '权限配置已更新', '管理员调整了部分菜单权限，刷新后可查看最新权限范围。', 1, NOW(), NOW() - INTERVAL '2 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '权限配置已更新' AND is_deleted = 0
);

INSERT INTO pms_archive_type (id, code, code_prefix, name, creator_id, updater_id)
VALUES
  (1, '001', 'SYS', '系统', 1, 1),
  (2, '002', 'PT', '问题类型', 1, 1)
ON CONFLICT (code) DO UPDATE SET
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
ON CONFLICT (code) DO NOTHING;

SELECT setval('pms_user_id_seq', COALESCE((SELECT MAX(id) FROM pms_user), 1), true);
SELECT setval('pms_role_id_seq', COALESCE((SELECT MAX(id) FROM pms_role), 1), true);
SELECT setval('pms_menu_id_seq', COALESCE((SELECT MAX(id) FROM pms_menu), 1), true);
SELECT setval('pms_archive_type_id_seq', COALESCE((SELECT MAX(id) FROM pms_archive_type), 1), true);
SELECT setval('pms_access_log_id_seq', COALESCE((SELECT MAX(id) FROM pms_access_log), 1), true);
SELECT setval('pms_user_preference_id_seq', COALESCE((SELECT MAX(id) FROM pms_user_preference), 1), true);
