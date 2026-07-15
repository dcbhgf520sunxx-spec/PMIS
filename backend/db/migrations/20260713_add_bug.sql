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
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((source_type=1 AND project_id IS NOT NULL AND requirement_id IS NULL) OR (source_type=2 AND requirement_id IS NOT NULL AND project_id IS NULL)),
  CHECK (status IN (1,2) OR resolution_id IS NULL),
  CHECK (status IN (1,2) OR resolved_date IS NULL),
  CHECK (status = 2 OR closed_date IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_bug_title_active ON pms_bug(title) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_bug_project ON pms_bug(project_id,is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_requirement ON pms_bug(requirement_id,is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_assignee_status ON pms_bug(assignee_id,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_type_status ON pms_bug(bug_type_id,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_severity_status ON pms_bug(severity,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_bug_created_at ON pms_bug(created_at DESC,id DESC) WHERE is_deleted=0;

INSERT INTO pms_archive_type(code,code_prefix,name,creator_id,updater_id)
VALUES
  ('bug_type','BT','Bug类型',1,1),
  ('bug_resolution','BR','Bug解决方案',1,1)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,code_prefix=EXCLUDED.code_prefix,updater_id=EXCLUDED.updater_id,updated_at=NOW();

INSERT INTO pms_archive(code,name,archive_type_id,sort_order,creator_id,updater_id)
SELECT v.code,v.name,t.id,v.sort_order,1,1
FROM pms_archive_type t
CROSS JOIN (VALUES
  ('BT001','功能',1),('BT002','界面',2),('BT003','性能',3),
  ('BT004','兼容',4),('BT005','安全',5),('BT006','其他',6)
) v(code,name,sort_order)
WHERE t.code='bug_type'
ON CONFLICT(code) DO NOTHING;

INSERT INTO pms_archive(code,name,archive_type_id,sort_order,creator_id,updater_id)
SELECT v.code,v.name,t.id,v.sort_order,1,1
FROM pms_archive_type t
CROSS JOIN (VALUES
  ('BR001','已修复',1),('BR002','设计如此',2),('BR003','无法重现',3),
  ('BR004','延期处理',4),('BR005','外部原因',5),('BR006','重复',6)
) v(code,name,sort_order)
WHERE t.code='bug_resolution'
ON CONFLICT(code) DO NOTHING;

INSERT INTO pms_menu(parent_id,name,code,type,path,icon,sort_order,creator_id,updater_id)
VALUES(0,'BUG管理','bug',2,'/bugs','BugOutlined',10,1,1)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,path=EXCLUDED.path,icon=EXCLUDED.icon,sort_order=EXCLUDED.sort_order,updater_id=EXCLUDED.updater_id,updated_at=NOW();

INSERT INTO pms_role_menu(role_id,menu_id)
SELECT 1,id FROM pms_menu WHERE code='bug'
ON CONFLICT DO NOTHING;
