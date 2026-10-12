BEGIN;
CREATE TABLE IF NOT EXISTS pms_llm_connection (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  enabled SMALLINT NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  is_default SMALLINT NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  timeout_seconds INTEGER NOT NULL DEFAULT 30 CHECK (timeout_seconds BETWEEN 5 AND 60),
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (is_default=0 OR enabled=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_connection_default ON pms_llm_connection(is_default) WHERE is_default=1;

INSERT INTO pms_menu (parent_id,name,code,type,path,sort_order,creator_id,updater_id)
SELECT id,'模型中心','model_center',2,'/model-connections',24,1,1 FROM pms_menu WHERE code='base_settings'
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,parent_id=EXCLUDED.parent_id,path=EXCLUDED.path,sort_order=EXCLUDED.sort_order;
INSERT INTO pms_role_menu(role_id,menu_id)
SELECT r.id,m.id FROM pms_role r CROSS JOIN pms_menu m WHERE r.code='admin' AND r.is_deleted=0 AND m.code='model_center'
ON CONFLICT DO NOTHING;
COMMIT;
