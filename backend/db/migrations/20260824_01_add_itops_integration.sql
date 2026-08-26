CREATE TABLE IF NOT EXISTS pms_integration_config (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  endpoint_url VARCHAR(500) NOT NULL,
  enabled SMALLINT NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  sync_interval_hours INTEGER NOT NULL DEFAULT 3 CHECK (sync_interval_hours > 0),
  initial_sync_date DATE NOT NULL DEFAULT DATE '2026-08-24',
  product_id BIGINT REFERENCES pms_product(id) ON DELETE RESTRICT,
  fallback_owner_id BIGINT REFERENCES pms_user(id) ON DELETE RESTRICT,
  last_cursor_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (last_status IN ('idle', 'running', 'success', 'failed')),
  last_total_count INTEGER NOT NULL DEFAULT 0 CHECK (last_total_count >= 0),
  last_success_count INTEGER NOT NULL DEFAULT 0 CHECK (last_success_count >= 0),
  last_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (last_failure_count >= 0),
  last_warning_count INTEGER NOT NULL DEFAULT 0 CHECK (last_warning_count >= 0),
  last_error VARCHAR(1000),
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_itops_sync_record (
  id BIGSERIAL PRIMARY KEY,
  integration_config_id BIGINT NOT NULL REFERENCES pms_integration_config(id) ON DELETE RESTRICT,
  batch_execution_id BIGINT REFERENCES pms_scheduled_task_execution(id) ON DELETE SET NULL,
  external_code VARCHAR(100) NOT NULL UNIQUE,
  source_category VARCHAR(50) NOT NULL,
  target_type VARCHAR(30) CHECK (target_type IN ('requirement', 'work_order')),
  target_id BIGINT,
  external_updated_at TIMESTAMPTZ,
  payload_hash VARCHAR(64) NOT NULL,
  payload_summary JSONB,
  sync_status VARCHAR(20) NOT NULL CHECK (sync_status IN ('success', 'failed', 'skipped')),
  warning_message VARCHAR(1000),
  error_message VARCHAR(1000),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itops_sync_record_status ON pms_itops_sync_record(sync_status, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_itops_sync_record_target ON pms_itops_sync_record(target_type, target_id);

INSERT INTO pms_integration_config
  (code, name, endpoint_url, enabled, sync_interval_hours, initial_sync_date, product_id, fallback_owner_id, creator_id, updater_id)
SELECT 'i8_it_operations', 'i8 运维单据同步',
  'http://183.129.242.91:8888/Znjs/api/ITOperationsTicketLookup/Post',
  CASE WHEN product.id IS NOT NULL AND owner.id IS NOT NULL THEN 1 ELSE 0 END,
  3, DATE '2026-08-24', product.id, owner.id, 1, 1
FROM (SELECT 1) seed
LEFT JOIN LATERAL (
  SELECT id FROM pms_product WHERE name = 'i8项目管理系统' AND is_deleted = 0 ORDER BY id LIMIT 1
) product ON TRUE
LEFT JOIN LATERAL (
  SELECT id FROM pms_user WHERE real_name = '韩健' AND status = 1 AND is_deleted = 0 ORDER BY id LIMIT 1
) owner ON TRUE
ON CONFLICT (code) DO NOTHING;

UPDATE pms_menu SET sort_order = 23, updated_at = NOW()
WHERE code = 'access_log' AND sort_order <> 23;

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
SELECT id, '接口管理', 'integration', 2, '/integrations', NULL, 22, 1, 1
FROM pms_menu WHERE code = 'base_settings' AND is_deleted = 0
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  sort_order = EXCLUDED.sort_order,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT 1, id FROM pms_menu WHERE code = 'integration'
ON CONFLICT (role_id, menu_id) DO NOTHING;
