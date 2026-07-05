CREATE TABLE IF NOT EXISTS pms_access_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES pms_user(id),
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

CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON pms_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_access_log_session ON pms_access_log(session_id);

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES (
  (SELECT id FROM pms_menu WHERE code = 'base_settings'),
  '访问日志',
  'access_log',
  2,
  '/access-logs',
  NULL,
  22,
  1,
  1
)
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
SELECT 1, id FROM pms_menu WHERE code = 'access_log'
ON CONFLICT (role_id, menu_id) DO NOTHING;
