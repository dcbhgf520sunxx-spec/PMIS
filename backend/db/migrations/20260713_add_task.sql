CREATE TABLE IF NOT EXISTS pms_task (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, description TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS uk_task_name_active ON pms_task(name) WHERE is_deleted=0;
CREATE INDEX IF NOT EXISTS idx_task_project ON pms_task(project_id,is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_requirement ON pms_task(requirement_id,is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_owner_status ON pms_task(owner_id,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_type_status ON pms_task(task_type,status,is_deleted);
CREATE INDEX IF NOT EXISTS idx_task_expected_end ON pms_task(expected_end_date,is_deleted);

INSERT INTO pms_archive_type(code,code_prefix,name,creator_id,updater_id)
VALUES('task_type','TT','任务类型',1,1)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,updater_id=EXCLUDED.updater_id,updated_at=NOW();
INSERT INTO pms_archive(code,name,archive_type_id,sort_order,creator_id,updater_id)
SELECT v.code,v.name,t.id,v.sort_order,1,1 FROM pms_archive_type t CROSS JOIN (VALUES
 ('TT001','需求',1),('TT002','设计',2),('TT003','开发',3),('TT004','测试',4),
 ('TT005','研究',5),('TT006','讨论',6),('TT007','事务',7),('TT008','其他',8)
) v(code,name,sort_order) WHERE t.code='task_type' ON CONFLICT(code) DO NOTHING;
INSERT INTO pms_menu(parent_id,name,code,type,path,icon,sort_order,creator_id,updater_id)
VALUES(0,'任务管理','task',2,'/tasks','CheckSquareOutlined',9,1,1)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,path=EXCLUDED.path,icon=EXCLUDED.icon,sort_order=EXCLUDED.sort_order,updater_id=EXCLUDED.updater_id,updated_at=NOW();
INSERT INTO pms_role_menu(role_id,menu_id) SELECT 1,id FROM pms_menu WHERE code='task' ON CONFLICT DO NOTHING;
