ALTER TABLE pms_project
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_project_priority') THEN
    ALTER TABLE pms_project
      ADD CONSTRAINT chk_project_priority CHECK (priority IN (0, 1, 2));
  END IF;
END $$;

ALTER TABLE pms_requirement ALTER COLUMN priority SET DEFAULT 0;
ALTER TABLE pms_task ALTER COLUMN priority SET DEFAULT 0;

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, status, creator_id, updater_id)
VALUES
  ((SELECT id FROM pms_menu WHERE code = 'requirement'), '调整优先级', 'requirement_priority_adjust', 3, NULL, NULL, 701, 1, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'project'), '调整优先级', 'project_priority_adjust', 3, NULL, NULL, 801, 1, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'task'), '调整优先级', 'task_priority_adjust', 3, NULL, NULL, 901, 1, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM pms_role r
JOIN pms_menu m ON m.code IN ('requirement_priority_adjust', 'project_priority_adjust', 'task_priority_adjust')
WHERE r.code = 'admin' AND r.is_deleted = 0
ON CONFLICT (role_id, menu_id) DO NOTHING;
