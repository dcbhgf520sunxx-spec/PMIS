CREATE TABLE IF NOT EXISTS pms_requirement (
  id BIGSERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, description TEXT,
  requirement_type SMALLINT NOT NULL CHECK (requirement_type IN (1,2,3,4)),
  product_id BIGINT NOT NULL REFERENCES pms_product(id) ON DELETE RESTRICT,
  project_id BIGINT REFERENCES pms_project(id) ON DELETE RESTRICT,
  owner_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority IN (0,1,2)), status SMALLINT NOT NULL,
  is_overdue SMALLINT CHECK (is_overdue IN (0,1)), submitter_name VARCHAR(50) NOT NULL,
  submitter_dept VARCHAR(100), submit_date DATE NOT NULL, start_date DATE, expected_end_date DATE,
  actual_end_date DATE, pause_date DATE, completion_status TEXT,
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_requirement_title_active ON pms_requirement(title) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_requirement_product_status ON pms_requirement(product_id,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_project ON pms_requirement(project_id,is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_owner_status ON pms_requirement(owner_id,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_type_status ON pms_requirement(requirement_type,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_requirement_expected_end ON pms_requirement(expected_end_date,is_deleted);
INSERT INTO pms_menu (parent_id,name,code,type,path,icon,sort_order,creator_id,updater_id)
VALUES (0,'需求管理','requirement',2,'/requirements','FileTextOutlined',8,1,1)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,path=EXCLUDED.path,icon=EXCLUDED.icon,sort_order=EXCLUDED.sort_order,updater_id=EXCLUDED.updater_id,updated_at=NOW();
INSERT INTO pms_role_menu(role_id,menu_id) SELECT 1,id FROM pms_menu WHERE code='requirement' ON CONFLICT DO NOTHING;
SELECT setval('pms_menu_id_seq',COALESCE((SELECT MAX(id) FROM pms_menu),1),true);
