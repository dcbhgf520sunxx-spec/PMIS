ALTER TABLE pms_work_order
  ADD COLUMN IF NOT EXISTS system_id BIGINT;

ALTER TABLE pms_work_order
  ALTER COLUMN problem_type TYPE BIGINT USING problem_type::BIGINT;

CREATE TEMP TABLE IF NOT EXISTS pms_work_order_legacy_problem_type AS
SELECT id, problem_type
FROM pms_work_order
WHERE problem_type IN (1, 2, 3, 4, 5)
  AND (
    system_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pms_archive a
      JOIN pms_archive_type t ON a.archive_type_id = t.id
      WHERE a.id = pms_work_order.problem_type
        AND t.code_prefix = 'PT'
    )
  );

INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id)
VALUES
  ('001', 'SYS', '系统', 1, 1)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  code_prefix = EXCLUDED.code_prefix,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

DO $$
DECLARE
  next_code TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pms_archive_type WHERE code_prefix = 'PT') THEN
    UPDATE pms_archive_type
    SET name = '问题类型',
        updater_id = 1,
        is_deleted = 0,
        updated_at = NOW()
    WHERE code_prefix = 'PT';
  ELSE
    SELECT LPAD((COALESCE(MAX(code::INT), 0) + 1)::TEXT, 3, '0')
    INTO next_code
    FROM pms_archive_type
    WHERE code ~ '^[0-9]+$';

    INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id)
    VALUES (next_code, 'PT', '问题类型', 1, 1);
  END IF;
END $$;

INSERT INTO pms_archive (code, name, archive_type_id, sort_order, creator_id, updater_id)
VALUES
  ('SYS001', '后台管理系统', (SELECT id FROM pms_archive_type WHERE code = '001'), 1, 1, 1),
  ('PT001', '日常操作', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 1, 1, 1),
  ('PT002', '系统优化', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 2, 1, 1),
  ('PT003', '故障报障', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 3, 1, 1),
  ('PT004', '后台维护', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 4, 1, 1),
  ('PT005', '其他', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 5, 1, 1)
ON CONFLICT (code) DO NOTHING;

UPDATE pms_work_order
SET system_id = (SELECT id FROM pms_archive WHERE code = 'SYS001')
WHERE system_id IS NULL;

UPDATE pms_work_order
SET problem_type = CASE problem_type
  WHEN 1 THEN (SELECT id FROM pms_archive WHERE code = 'PT001')
  WHEN 2 THEN (SELECT id FROM pms_archive WHERE code = 'PT002')
  WHEN 3 THEN (SELECT id FROM pms_archive WHERE code = 'PT003')
  WHEN 4 THEN (SELECT id FROM pms_archive WHERE code = 'PT004')
  WHEN 5 THEN (SELECT id FROM pms_archive WHERE code = 'PT005')
  ELSE problem_type
END
WHERE id IN (SELECT id FROM pms_work_order_legacy_problem_type);

DROP TABLE IF EXISTS pms_work_order_legacy_problem_type;
